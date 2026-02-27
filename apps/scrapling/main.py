from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scrapling import Fetcher
import urllib.parse
from typing import Optional
import re

app = FastAPI(title="SmartOut Scrapling Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeConfig(BaseModel):
    include_company_info: bool = True
    include_locations: bool = True
    include_departments: bool = True
    include_dictionary: bool = False

class ExtractRequest(BaseModel):
    url: str
    config: Optional[ScrapeConfig] = None

class LocationModel(BaseModel):
    id: str
    name: str
    type: str
    function: str
    isComplete: bool

class DepartmentModel(BaseModel):
    id: str
    name: str
    roles: list[str]
    description: str
    isComplete: bool

class ImageModel(BaseModel):
    src: str
    alt: str

class LinkModel(BaseModel):
    href: str
    text: str

class RawScrapeResponse(BaseModel):
    title: str
    description: str
    text_content: str
    images: list[ImageModel]
    files: list[LinkModel]

class ExtractResponse(BaseModel):
    companyName: str
    locations: list[LocationModel]
    departments: list[DepartmentModel]
    email: Optional[str] = None
    phone: Optional[str] = None
    summary: Optional[str] = None
    pageDictionary: Optional[dict[str, str]] = None
    images: list[ImageModel] = []
    menus: list[LinkModel] = []
    socialLinks: dict[str, str] = {}
    reservationUrl: Optional[str] = None

def clean_url(url: str) -> str:
    target_url = url
    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        target_url = f"https://{target_url}"
    return target_url

@app.post("/extract", response_model=ExtractResponse)
def extract_workspace_data(req: ExtractRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="Missing url parameter.")

    try:
        config = req.config or ScrapeConfig()
        target_url = clean_url(req.url)
        page = Fetcher.get(target_url)
        
        title = page.css("title::text").get("Unknown Company")
        description = page.css("meta[name='description']::attr(content)").get("")
        
        raw_text_nodes = page.css("p::text, h1::text, h2::text, h3::text, li::text, span::text, div::text").getall()
        clean_text = " ".join([t.strip() for t in raw_text_nodes if t.strip()])
        
        # --- DEEP SCRAPING (About / Om oss) ---
        # Look for "om oss" or "about" to gather more context
        anchor_nodes = page.css("a")
        about_links = []
        for a in anchor_nodes:
            text = (a.text or "").strip().lower()
            href = a.attrib.get("href", "")
            if href and ("om oss" in text or "about" in text or "om-" in href.lower() or "about-" in href.lower()):
                full_href = urllib.parse.urljoin(target_url, href)
                about_links.append(full_href)
        
        # Scrape the first "about" page if found to enhance the context
        if about_links:
            try:
                about_page = Fetcher.get(about_links[0])
                about_text_nodes = about_page.css("p::text, span::text, div::text").getall()
                clean_text += " " + " ".join([t.strip() for t in about_text_nodes if t.strip()])
            except:
                pass

        lower_text = clean_text.lower()

        email = None
        phone = None
        summary = description.strip() if description else ""

        if True: # Always extract contact info if possible
            email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", clean_text)
            if email_match:
                email = email_match.group(0)
                
            phone_match = re.search(r"(?:\+47|0047)?[\s\-]?(\d{2,3}[\s\-]?\d{2}[\s\-]?\d{2,3})", clean_text)
            if phone_match:
                phone = phone_match.group(0).strip()
                
            if not summary and clean_text:
                 summary = clean_text[:300] + "..."

        detected_locations = []
        if config.include_locations:
            loc_id = 1
            if "bar" in lower_text or "drinks" in lower_text or "vin" in lower_text:
                detected_locations.append(LocationModel(id=str(loc_id), name="Bar", type="Indoor", function="", isComplete=False))
                loc_id += 1
                
            if "terrace" in lower_text or "uteservering" in lower_text or "outdoor" in lower_text:
                detected_locations.append(LocationModel(id=str(loc_id), name="Uteservering / Terrace", type="Outdoor", function="", isComplete=False))
                loc_id += 1
                
            if len(detected_locations) == 0:
                detected_locations.append(LocationModel(id=str(loc_id), name="Main Dining", type="Indoor", function="", isComplete=False))

        detected_departments = []
        if config.include_departments:
            dept_id = 1
            if "kitchen" in lower_text or "chef" in lower_text or "meny" in lower_text or "mat" in lower_text:
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Kjøkken", roles=["Head Chef", "Line Cook", "Oppvask"], description="", isComplete=False))
                dept_id += 1
                
            if "service" in lower_text or "waiter" in lower_text or "bord" in lower_text or "servitør" in lower_text:
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Service / Floor", roles=["Hovmester", "Servitør", "Bartender"], description="", isComplete=False))
                dept_id += 1

            if len(detected_departments) == 0:
                 detected_departments.append(DepartmentModel(id=str(dept_id), name="General Staff", roles=["Employee"], description="", isComplete=False))

        # --- IMAGES ---
        image_nodes = page.css("img")
        images = []
        for img in image_nodes:
            src = img.attrib.get("src", "")
            alt = img.attrib.get("alt", "")
            if src and not src.startswith("data:image"):
                src = urllib.parse.urljoin(target_url, src)
                # Filter out obvious tiny icons / logos
                if "icon" not in src.lower() and "logo" not in src.lower():
                    images.append(ImageModel(src=src, alt=alt))
        images = images[:10]

        # --- LINKS, MENUS, SOCIAL, RESERVATION ---
        page_dictionary = {}
        menus = []
        social_links = {}
        reservation_url = None

        social_domains = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com"]
        booking_domains = ["resdiary", "sevenrooms", "bookatable", "formitable", "dinnerbooking", "book"]

        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            text = (a.text or "").strip()
            if not href or href.startswith("javascript") or href.startswith("#"):
                continue

            full_href = urllib.parse.urljoin(target_url, href)

            if config.include_dictionary and text:
                page_dictionary[text] = full_href

            # Check Socials
            for domain in social_domains:
                if domain in href.lower():
                    platform = domain.replace(".com", "")
                    social_links[platform] = full_href
            
            # Check Reservation / Booking
            text_lower = text.lower()
            if not reservation_url:
                if any(book in href.lower() for book in booking_domains) or "bestill bord" in text_lower or "book table" in text_lower or "bordbestilling" in text_lower:
                    reservation_url = full_href

            # Check Menus (often PDFs or specific paths)
            menu_keywords = ["meny", "menu", "mat", "drikke", "vin", "wine", "food"]
            if any(m in text_lower or m in href.lower() for m in menu_keywords) or href.lower().endswith(".pdf"):
                display_text = text if text else "Meny / PDF"
                if len(display_text) > 30:
                    display_text = display_text[:27] + "..."
                menus.append(LinkModel(href=full_href, text=display_text))

        # Simple deduplication of menus
        unique_menus = []
        seen_urls = set()
        for m in menus:
            if m.href not in seen_urls:
                unique_menus.append(m)
                seen_urls.add(m.href)

        return ExtractResponse(
            companyName=title.strip(), 
            locations=detected_locations, 
            departments=detected_departments,
            email=email,
            phone=phone,
            summary=summary,
            pageDictionary=page_dictionary if config.include_dictionary else None,
            images=images,
            menus=unique_menus,
            socialLinks=social_links,
            reservationUrl=reservation_url
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scrape-raw", response_model=RawScrapeResponse)
def scrape_raw_data(req: ExtractRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="Missing url parameter.")

    target_url = clean_url(req.url)

    try:
        page = Fetcher.get(target_url)
        
        title = page.css("title::text").get("")
        description = page.css("meta[name='description']::attr(content)").get("")
        
        # Extract readable text, removing excessive whitespace
        raw_text_nodes = page.css("p::text, h1::text, h2::text, h3::text, li::text, span::text, div::text").getall()
        clean_text = " ".join([t.strip() for t in raw_text_nodes if t.strip()])
        
        # Extract images (limit to reasonable number to prevent massive payloads)
        image_nodes = page.css("img")
        images = []
        for img in image_nodes:
            src = img.attrib.get("src", "")
            alt = img.attrib.get("alt", "")
            if src and not src.startswith("data:image"):
                # robust resolution to absolute url
                src = urllib.parse.urljoin(target_url, src)
                images.append(ImageModel(src=src, alt=alt))
        
        # Limit images to top 20
        images = images[:20]

        # Extract file links
        anchor_nodes = page.css("a")
        files = []
        file_extensions = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt")
        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            text = a.text or ""
            if href.lower().endswith(file_extensions):
                # robust resolution to absolute url
                href = urllib.parse.urljoin(target_url, href)
                files.append(LinkModel(href=href, text=text.strip()))

        return RawScrapeResponse(
            title=title.strip(),
            description=description.strip(),
            text_content=clean_text,
            images=images,
            files=files
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "scrapling",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

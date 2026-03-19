import os
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from scrapling import Fetcher
import urllib.parse
from typing import Optional
import re
from extractors import extract_file, SUPPORTED_EXTENSIONS
from extractors.pdf import ExtractionError
from intelligence import (
    EnrichRequest, EnrichResponse, handle_enrich,
    GenerateRequest, GenerateResponse, handle_generate,
)

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("scrapling")

app = FastAPI(title="SmartOut Scrapling Microservice")

DASHBOARD_HTML = (Path(__file__).parent / "dashboard.html").read_text()

# Bearer token auth — required when SCRAPLING_AUTH_TOKEN is set.
# Internal Docker callers without the env var skip auth (backwards compatible).
SCRAPLING_AUTH_TOKEN = os.environ.get("SCRAPLING_AUTH_TOKEN")

async def verify_auth(request: Request):
    if not SCRAPLING_AUTH_TOKEN:
        return  # No token configured — allow (internal Docker network)
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {SCRAPLING_AUTH_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/", response_class=HTMLResponse)
def dashboard():
    return DASHBOARD_HTML

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)

class TripAdvisorRequest(BaseModel):
    url: Optional[str] = None
    company_name: Optional[str] = None
    city: Optional[str] = None
    max_pages: int = 5  # Each page has ~10 reviews

class ReviewModel(BaseModel):
    title: str
    text: str
    rating: int  # 1-5
    date: str
    author: str
    language: Optional[str] = None

class TripAdvisorResponse(BaseModel):
    restaurant_name: Optional[str] = None
    overall_rating: Optional[float] = None
    total_reviews: Optional[int] = None
    tripadvisor_url: str
    best_reviews: list[ReviewModel]
    worst_reviews: list[ReviewModel]
    all_reviews_count: int

class ScrapeConfig(BaseModel):
    include_company_info: bool = True
    include_locations: bool = True
    include_departments: bool = True
    include_dictionary: bool = False
    nace_code: Optional[str] = None  # e.g. "56.101" for restaurants, "62.100" for software

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
    description: Optional[str] = None
    logoUrl: Optional[str] = None
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

def fetch_with_fallback(url: str):
    """Fetch URL, falling back to without www if SSL fails."""
    target = clean_url(url)
    try:
        return Fetcher.get(target)
    except Exception as e:
        err_str = str(e).lower()
        if "ssl" in err_str or "certificate" in err_str:
            # Try without www or with www
            from urllib.parse import urlparse
            parsed = urlparse(target)
            if parsed.hostname and parsed.hostname.startswith("www."):
                alt = target.replace("://www.", "://", 1)
            else:
                alt = target.replace("://", "://www.", 1)
            try:
                return Fetcher.get(alt)
            except:
                pass
        raise

@app.post("/extract", response_model=ExtractResponse, dependencies=[Depends(verify_auth)])
def extract_workspace_data(req: ExtractRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="Missing url parameter.")

    try:
        config = req.config or ScrapeConfig()
        target_url = clean_url(req.url)
        page = fetch_with_fallback(req.url)
        
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
        logo_url = None

        # --- EMAIL: try mailto links first, then regex on text ---
        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            if href.startswith("mailto:"):
                email = href.replace("mailto:", "").split("?")[0].strip()
                break
        if not email:
            # Also check the full HTML for mailto links the CSS selector might miss
            html_str = str(page.body) if hasattr(page, 'body') else clean_text
            mailto_match = re.search(r'mailto:([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', html_str)
            if mailto_match:
                email = mailto_match.group(1)
        if not email:
            email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", clean_text)
            if email_match:
                email = email_match.group(0)

        # --- PHONE: Norwegian format (8 digits, often XX XX XX XX or XXX XX XXX) ---
        # Try tel: links first
        for a in anchor_nodes:
            href = a.attrib.get("href", "")
            if href.startswith("tel:"):
                phone = href.replace("tel:", "").replace("%20", " ").strip()
                break
        if not phone:
            phone_match = re.search(r"(?:\+47\s?)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})", clean_text)
            if phone_match:
                phone = phone_match.group(0).strip()

        # --- SUMMARY / DESCRIPTION ---
        if not summary and clean_text:
            summary = clean_text[:300] + "..."

        # --- LOGO: favicon, apple-touch-icon, or img with logo/brand in src/alt ---
        logo_candidates = [
            page.css("link[rel='apple-touch-icon']::attr(href)").get(""),
            page.css("link[rel='icon'][type='image/png']::attr(href)").get(""),
            page.css("link[rel='shortcut icon']::attr(href)").get(""),
            page.css("link[rel='icon']::attr(href)").get(""),
            page.css("meta[property='og:image']::attr(content)").get(""),
        ]
        for candidate in logo_candidates:
            if candidate:
                logo_url = urllib.parse.urljoin(target_url, candidate)
                break
        # Also look for img tags with logo in src or alt
        if not logo_url:
            for img in page.css("img"):
                src = img.attrib.get("src", "")
                alt = img.attrib.get("alt", "")
                if "logo" in src.lower() or "logo" in alt.lower() or "brand" in src.lower():
                    logo_url = urllib.parse.urljoin(target_url, src)
                    break

        # --- INDUSTRY DETECTION via NACE code ---
        nace = config.nace_code or ""
        is_hospitality = nace.startswith("56.") or nace.startswith("55.")  # Food/accommodation
        is_retail = nace.startswith("47.")
        is_tech = nace.startswith("62.") or nace.startswith("63.")  # Software/IT
        is_health = nace.startswith("86.") or nace.startswith("87.")

        # If no NACE code, try keyword detection for hospitality
        if not nace:
            hospitality_keywords = ["restaurant", "bar", "café", "kafé", "hotel", "hotell", "mat", "meny", "servering", "kitchen", "chef"]
            if any(k in lower_text for k in hospitality_keywords):
                is_hospitality = True

        detected_locations = []
        if config.include_locations:
            loc_id = 1
            if is_hospitality:
                if "bar" in lower_text or "drinks" in lower_text or "vin" in lower_text:
                    detected_locations.append(LocationModel(id=str(loc_id), name="Bar", type="Indoor", function="", isComplete=False))
                    loc_id += 1
                if "terrace" in lower_text or "uteservering" in lower_text or "outdoor" in lower_text:
                    detected_locations.append(LocationModel(id=str(loc_id), name="Uteservering / Terrace", type="Outdoor", function="", isComplete=False))
                    loc_id += 1
                if len(detected_locations) == 0:
                    detected_locations.append(LocationModel(id=str(loc_id), name="Main Dining", type="Indoor", function="", isComplete=False))
            else:
                detected_locations.append(LocationModel(id=str(loc_id), name="Hovedkontor", type="Indoor", function="", isComplete=False))

        detected_departments = []
        if config.include_departments:
            dept_id = 1
            if is_hospitality:
                if "kitchen" in lower_text or "chef" in lower_text or "meny" in lower_text or "mat" in lower_text:
                    detected_departments.append(DepartmentModel(id=str(dept_id), name="Kjøkken", roles=["Head Chef", "Line Cook", "Oppvask"], description="", isComplete=False))
                    dept_id += 1
                if "service" in lower_text or "waiter" in lower_text or "bord" in lower_text or "servitør" in lower_text:
                    detected_departments.append(DepartmentModel(id=str(dept_id), name="Service / Floor", roles=["Hovmester", "Servitør", "Bartender"], description="", isComplete=False))
                    dept_id += 1
                if len(detected_departments) == 0:
                    detected_departments.append(DepartmentModel(id=str(dept_id), name="Kjøkken", roles=["Head Chef", "Line Cook"], description="", isComplete=False))
                    dept_id += 1
                    detected_departments.append(DepartmentModel(id=str(dept_id), name="Service / Floor", roles=["Hovmester", "Servitør"], description="", isComplete=False))
            elif is_tech:
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Utvikling", roles=["Utvikler", "Tech Lead"], description="", isComplete=False))
                dept_id += 1
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Salg", roles=["Selger", "Salgsleder"], description="", isComplete=False))
                dept_id += 1
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Support", roles=["Kundeservice", "Support"], description="", isComplete=False))
            elif is_retail:
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Butikk", roles=["Butikkmedarbeider", "Butikksjef"], description="", isComplete=False))
                dept_id += 1
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Lager", roles=["Lagermedarbeider"], description="", isComplete=False))
            elif is_health:
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Klinisk", roles=["Sykepleier", "Lege"], description="", isComplete=False))
                dept_id += 1
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Administrasjon", roles=["Administrator"], description="", isComplete=False))
            else:
                detected_departments.append(DepartmentModel(id=str(dept_id), name="Drift", roles=["Medarbeider"], description="", isComplete=False))

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
            description=description.strip() if description else None,
            logoUrl=logo_url,
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

@app.post("/scrape-raw", response_model=RawScrapeResponse, dependencies=[Depends(verify_auth)])
def scrape_raw_data(req: ExtractRequest):
    if not req.url:
        raise HTTPException(status_code=400, detail="Missing url parameter.")

    target_url = clean_url(req.url)

    try:
        page = fetch_with_fallback(req.url)
        
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

@app.post("/tripadvisor", response_model=TripAdvisorResponse, dependencies=[Depends(verify_auth)])
def scrape_tripadvisor(req: TripAdvisorRequest):
    """Scrape TripAdvisor reviews — returns 10 best and 10 worst.

    TODO: TripAdvisor blocks direct scraping (403 + JS rendering).
    Integrate Apify TripAdvisor actor or similar service.
    """
    raise HTTPException(
        status_code=501,
        detail="TripAdvisor scraping requires Apify integration (not yet configured). "
               "Provide an Apify API key or use the Serper web-search-intelligence endpoint for basic rating data.",
    )


# TODO: Add bearer token auth before production deployment.
# Currently relies on Docker network isolation (no public Caddy route).
# See docs/protocols/SECURITY.md §15.5 for service auth requirements.
@app.post("/extract/document", dependencies=[Depends(verify_auth)])
async def extract_document(file: UploadFile = File(...)):
    """Extract text and images from a single uploaded document."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    logger.info(f"[extract/document] file={file.filename} content_type={file.content_type} size={len(file_bytes)} bytes")

    if not file_bytes:
        logger.warning(f"[extract/document] Empty file: {file.filename}")
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        result = await extract_file(file_bytes, file.filename, file.content_type)
        logger.info(f"[extract/document] OK file={file.filename} chars={result.get('characters', 0)} images={len(result.get('images', []))} method={result.get('method')}")
        return result
    except ValueError as e:
        supported = sorted(SUPPORTED_EXTENSIONS.keys())
        logger.warning(f"[extract/document] ValueError file={file.filename}: {e}")
        raise HTTPException(status_code=400, detail={
            "error": str(e),
            "supported": supported,
        })
    except ExtractionError as e:
        logger.error(f"[extract/document] ExtractionError file={file.filename}: {e}")
        raise HTTPException(status_code=422, detail={
            "error": "Could not extract text from file",
            "detail": str(e),
        })
    except Exception as e:
        logger.error(f"[extract/document] Unexpected error file={file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/extract/document/batch", dependencies=[Depends(verify_auth)])
async def extract_document_batch(files: list[UploadFile] = File(...)):
    """Extract text and images from multiple uploaded documents."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results = []
    total_characters = 0
    total_images = 0

    for file in files:
        if not file.filename:
            continue
        file_bytes = await file.read()
        if not file_bytes:
            continue
        try:
            result = await extract_file(file_bytes, file.filename, file.content_type)
            results.append(result)
            total_characters += result.get("characters", 0)
            total_images += len(result.get("images", []))
        except (ValueError, ExtractionError) as e:
            results.append({
                "filename": file.filename,
                "error": str(e),
                "text": None,
                "images": [],
                "pages": None,
                "characters": 0,
                "method": None,
            })

    return {
        "results": results,
        "total_characters": total_characters,
        "total_images": total_images,
    }


# ── Intelligence pipeline endpoints (enrichment + generation) ─────

@app.post("/enrich", response_model=EnrichResponse, dependencies=[Depends(verify_auth)])
async def enrich_endpoint(req: EnrichRequest):
    return await handle_enrich(req)


@app.post("/generate", response_model=GenerateResponse, dependencies=[Depends(verify_auth)])
async def generate_endpoint(req: GenerateRequest):
    return await handle_generate(req)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "scrapling",
        "version": "0.2.0",
        "extractors": sorted(SUPPORTED_EXTENSIONS.keys()),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

---
title: Scrapling API Reference
status: done
updated: 2026-03-10
created: 2026-03-03
module: onboarding
tags: [api, scraping, microservice, python, droplet]
---

# Scrapling API Reference

> Python (FastAPI) microservice for web scraping and document text extraction. Scrapes business websites for onboarding data and extracts text/images from uploaded documents (PDF, DOCX, XLSX, CSV, TXT, images).

## Hosting

| Environment     | URL                     | Notes                                                        |
| --------------- | ----------------------- | ------------------------------------------------------------ |
| Production (DO) | `http://scrapling:8000` | Internal Docker network on `164.92.176.42` — no public route |
| Docker (infra/) | `http://scrapling:8000` | Same internal network, accessed by service name              |
| Local dev       | `http://localhost:8000` | `cd services/scrapling && python main.py`                    |

**Droplet:** `164.92.176.42` (ubuntu-service-smartout)
**Source:** `services/scrapling/main.py`

> Scrapling has no Caddy route — it is never exposed publicly. Other services on the same Docker network reach it via `http://scrapling:8000`.

---

## Authentication

None. The service is internal-only — never exposed directly to the public internet. All external access goes through:

| Caller            | Path                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| Onboarding wizard | Edge Function `gather-workspace-intelligence` → scrapling `/extract`    |
| Document analysis | Edge Function `analyze-setup-documents` → scrapling `/extract/document` |
| Scraper test page | Next.js API route `/api/scrape/raw` → scrapling `/scrape-raw`           |
| Edge Function     | `scrape-raw-data` → scrapling `/scrape-raw`                             |

---

## Environment Variables

| Variable                | Where                             | Value                       | Notes                                   |
| ----------------------- | --------------------------------- | --------------------------- | --------------------------------------- |
| `SCRAPLING_SERVICE_URL` | Edge Functions (Supabase secrets) | `http://164.92.176.42:8000` | Set via Supabase dashboard → Secrets    |
| `SCRAPLING_SERVICE_URL` | Next.js (`apps/web/.env.local`)   | `http://164.92.176.42:8000` | For API routes that proxy to scrapling  |
| `SCRAPLING_SERVICE_URL` | Stage Engine (`.env` on droplet)  | `http://scrapling:8000`     | Uses Docker service name (same network) |

> **From the droplet (same Docker network):** use `http://scrapling:8000`
> **From external services (Edge Functions, Next.js, n8n):** use `http://164.92.176.42:8000`
>
> ⚠️ Port 8000 is open on the droplet but has no auth. To lock it down, add a UFW rule: `ufw allow from <supabase-ip> to any port 8000`

---

## Endpoints

### `POST /extract`

Smart extraction. Scrapes a website and returns structured business data (company info, locations, departments, contacts, images, menus, social links, booking URLs). Also deep-scrapes "Om oss" / "About" pages if found.

**Used by:** `gather-workspace-intelligence` Edge Function (onboarding wizard)

#### Request

```json
{
  "url": "https://restaurant-example.no",
  "config": {
    "include_company_info": true,
    "include_locations": true,
    "include_departments": true,
    "include_dictionary": false
  }
}
```

| Field                         | Type    | Required | Default   | Description                                           |
| ----------------------------- | ------- | -------- | --------- | ----------------------------------------------------- |
| `url`                         | string  | Yes      | —         | Target URL (auto-prefixed with `https://` if missing) |
| `config`                      | object  | No       | See below | Controls which data to extract                        |
| `config.include_company_info` | boolean | No       | `true`    | Extract contact info (email, phone)                   |
| `config.include_locations`    | boolean | No       | `true`    | Detect locations from page keywords                   |
| `config.include_departments`  | boolean | No       | `true`    | Detect departments from page keywords                 |
| `config.include_dictionary`   | boolean | No       | `false`   | Return all links as key-value dictionary              |

#### Response `200 OK`

```json
{
  "companyName": "Restaurant Example",
  "locations": [
    {
      "id": "1",
      "name": "Bar",
      "type": "Indoor",
      "function": "",
      "isComplete": false
    },
    {
      "id": "2",
      "name": "Uteservering / Terrace",
      "type": "Outdoor",
      "function": "",
      "isComplete": false
    }
  ],
  "departments": [
    {
      "id": "1",
      "name": "Kjøkken",
      "roles": ["Head Chef", "Line Cook", "Oppvask"],
      "description": "",
      "isComplete": false
    },
    {
      "id": "2",
      "name": "Service / Floor",
      "roles": ["Hovmester", "Servitør", "Bartender"],
      "description": "",
      "isComplete": false
    }
  ],
  "email": "post@example.no",
  "phone": "+47 22 33 44 55",
  "summary": "A cozy restaurant in the heart of Oslo...",
  "pageDictionary": null,
  "images": [{ "src": "https://example.no/img/hero.jpg", "alt": "Interior shot" }],
  "menus": [{ "href": "https://example.no/meny.pdf", "text": "Meny / PDF" }],
  "socialLinks": {
    "instagram": "https://instagram.com/example",
    "facebook": "https://facebook.com/example"
  },
  "reservationUrl": "https://resdiary.com/restaurant/example"
}
```

| Field            | Type           | Description                                                                 |
| ---------------- | -------------- | --------------------------------------------------------------------------- |
| `companyName`    | string         | From `<title>` tag                                                          |
| `locations`      | Location[]     | Detected from keywords: bar, terrace, uteservering, drinks, vin, outdoor    |
| `departments`    | Department[]   | Detected from keywords: kitchen, chef, meny, mat, service, waiter, servitør |
| `email`          | string \| null | Regex-extracted from page text                                              |
| `phone`          | string \| null | Regex-extracted (Norwegian format `+47`)                                    |
| `summary`        | string \| null | Meta description or first 300 chars                                         |
| `pageDictionary` | object \| null | All links as `{text: href}` (only if `include_dictionary: true`)            |
| `images`         | Image[]        | Up to 10 images, excluding icons/logos, resolved to absolute URLs           |
| `menus`          | Link[]         | Links matching menu/meny/food/wine/PDF keywords                             |
| `socialLinks`    | object         | `{platform: url}` for Facebook, Instagram, LinkedIn, TikTok                 |
| `reservationUrl` | string \| null | First booking link found (Resdiary, SevenRooms, BookaTable, etc.)           |

**Detection logic:** If no locations are found, defaults to `[{name: "Main Dining"}]`. If no departments are found, defaults to `[{name: "General Staff"}]`.

---

### `POST /scrape-raw`

Raw extraction. Returns unprocessed text, images, and file links without any keyword-based inference. Good for diagnostics and custom processing.

**Used by:** `scrape-raw-data` Edge Function, Next.js `/api/scrape/raw` proxy

#### Request

```json
{
  "url": "https://restaurant-example.no"
}
```

| Field | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| `url` | string | Yes      | Target URL  |

#### Response `200 OK`

```json
{
  "title": "Restaurant Example — Mat & Drikke",
  "description": "A cozy restaurant in the heart of Oslo",
  "text_content": "Welcome to Restaurant Example. We serve seasonal dishes...",
  "images": [{ "src": "https://example.no/img/hero.jpg", "alt": "Interior shot" }],
  "files": [{ "href": "https://example.no/meny.pdf", "text": "Lunch Menu" }]
}
```

| Field          | Type    | Description                                                              |
| -------------- | ------- | ------------------------------------------------------------------------ |
| `title`        | string  | `<title>` tag content                                                    |
| `description`  | string  | `<meta name="description">` content                                      |
| `text_content` | string  | All visible text from p, h1-h3, li, span, div elements                   |
| `images`       | Image[] | Up to 20 images (excludes data URIs), resolved to absolute URLs          |
| `files`        | Link[]  | Links ending in `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.txt` |

---

### `POST /extract/document`

Document extraction. Accepts a single uploaded file and returns extracted text (as markdown for structured documents) plus embedded images.

**Used by:** `analyze-setup-documents` Edge Function (onboarding wizard document analysis)

**Supported file types:** PDF, DOCX, XLSX, CSV, TXT, JPG, JPEG, PNG, WEBP

#### Request

```
Content-Type: multipart/form-data
Body: file=@document.pdf
```

#### Response `200 OK` — document with text

```json
{
  "filename": "personalhandbok.pdf",
  "content_type": "application/pdf",
  "text": "# Personalhandbok\n\n## Kapittel 1: HMS\n\nAlle ansatte skal...",
  "images": [
    {
      "page": 3,
      "index": 0,
      "base64": "iVBORw0KGgo...",
      "type": "png",
      "width": 800,
      "height": 600
    }
  ],
  "pages": 24,
  "characters": 45231,
  "method": "pymupdf4llm"
}
```

#### Response `200 OK` — image file

```json
{
  "filename": "rutine-foto.jpg",
  "content_type": "image/jpeg",
  "text": null,
  "images": [
    {
      "page": null,
      "index": 0,
      "base64": "iVBORw0KGgo...",
      "type": "jpeg",
      "width": 1200,
      "height": 900
    }
  ],
  "pages": null,
  "characters": 0,
  "method": "passthrough"
}
```

| Field          | Type           | Description                                                    |
| -------------- | -------------- | -------------------------------------------------------------- |
| `filename`     | string         | Original filename                                              |
| `content_type` | string         | MIME type                                                      |
| `text`         | string \| null | Extracted text (markdown for PDF/DOCX/XLSX, plain for CSV/TXT) |
| `images`       | Image[]        | Extracted images as base64 (from PDF) or original (for images) |
| `pages`        | number \| null | Page count (PDF only)                                          |
| `characters`   | number         | Character count of extracted text                              |
| `method`       | string         | Extraction method used (pymupdf4llm, python-docx, etc.)        |

**Extraction methods by file type:**

| Extension | Method       | Details                                                        |
| --------- | ------------ | -------------------------------------------------------------- |
| PDF       | pymupdf4llm  | Structured markdown. Fallback: pdfplumber for table-heavy PDFs |
| DOCX      | python-docx  | Paragraphs + tables as markdown                                |
| XLSX      | openpyxl     | All sheets as markdown tables                                  |
| CSV       | csv (stdlib) | Auto-detect delimiter, encoding detection                      |
| TXT       | passthrough  | UTF-8/Latin-1 encoding detection                               |
| Images    | passthrough  | Pillow validation + base64 encode. WEBP converted to PNG       |

#### Error Responses

| Status | When                                          | Response                                             |
| ------ | --------------------------------------------- | ---------------------------------------------------- |
| `400`  | Unsupported file type                         | `{"error": "Unsupported...", "supported": [...]}`    |
| `422`  | File cannot be parsed (e.g. scanned-only PDF) | `{"error": "Could not extract...", "detail": "..."}` |

---

### `POST /extract/document/batch`

Batch document extraction. Accepts multiple files and returns results for each.

#### Request

```
Content-Type: multipart/form-data
Body: files[]=@dok1.pdf&files[]=@dok2.docx&files[]=@bilde.jpg
```

#### Response `200 OK`

```json
{
  "results": [
    { "filename": "dok1.pdf", "text": "# ...", "images": [...], "pages": 12, "characters": 25000, "method": "pymupdf4llm" },
    { "filename": "dok2.docx", "text": "...", "images": [], "pages": null, "characters": 8500, "method": "python-docx" }
  ],
  "total_characters": 33500,
  "total_images": 4
}
```

Failed files are included with an `error` field instead of raising a 400/422.

---

### `GET /health`

Health check.

#### Response `200 OK`

```json
{
  "status": "healthy",
  "timestamp": "2026-03-03T12:00:00.000000",
  "service": "scrapling",
  "version": "0.2.0",
  "extractors": ["csv", "docx", "jpeg", "jpg", "pdf", "png", "txt", "webp", "xlsx"]
}
```

---

## Error Responses

All errors return JSON with an HTTP status code.

| Status | When                                                                |
| ------ | ------------------------------------------------------------------- |
| `400`  | Missing `url` parameter, unsupported file type, no file provided    |
| `422`  | File could not be parsed (e.g. scanned-only PDF with no text layer) |
| `500`  | Scraping/extraction failed (target unreachable, parsing error)      |

```json
{
  "detail": "Error message describing what went wrong"
}
```

---

## Data Flow

### URL scraping (onboarding wizard)

```
Browser → Onboarding wizard (InitStep)
  → Supabase Edge Function: gather-workspace-intelligence
    → Scrapling /extract (structured data)
    → Brreg API (Norwegian business registry)
    → Creates onboarding_session record
    → Fires background: web-search-intelligence
  ← Returns { scrapedData, brregData, sessionId }
```

### Document analysis (onboarding wizard)

```
Browser → DocumentDropStep (file upload to Supabase Storage)
  → Supabase Edge Function: analyze-setup-documents
    → Downloads files from Storage
    → For each file: POST to Scrapling /extract/document
    ← Scrapling returns { text (markdown), images (base64), pages, method }
    → Assembles text + images
    → Sends to Anthropic Claude API (multimodal: text + images)
    ← Claude returns structured JSON (policies, employees, shifts, etc.)
  ← Returns extractedData → wizard pre-fills steps 3-8
```

### Raw scraping (diagnostics)

```
Browser → /scrape test page
  → Next.js /api/scrape/raw (proxy)
    → Scrapling /scrape-raw (raw data)
  ← Returns { title, description, text_content, images, files }
```

---

## Running Locally

```bash
cd services/scrapling
pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

Dependencies: `fastapi`, `uvicorn`, `scrapling[all]`, `pydantic`, `lxml`, `aiohttp`, `curl_cffi`, `playwright`, `python-multipart`, `pymupdf4llm`, `pymupdf`, `pdfplumber`, `python-docx`, `openpyxl`, `Pillow`

---

## cURL Examples

> Replace `$SCRAPLING` with the appropriate URL:
>
> - **Local dev:** `http://localhost:8000`
> - **From droplet (same network):** `http://scrapling:8000`
> - **From external service:** `http://164.92.176.42:8000`

### Extract structured data

```bash
curl -X POST $SCRAPLING/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-restaurant.no"}'
```

### Extract with dictionary enabled

```bash
curl -X POST $SCRAPLING/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example-restaurant.no",
    "config": {
      "include_dictionary": true
    }
  }'
```

### Raw scrape

```bash
curl -X POST $SCRAPLING/scrape-raw \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-restaurant.no"}'
```

### Extract document (single file)

```bash
curl -X POST $SCRAPLING/extract/document \
  -F "file=@personalhandbok.pdf"
```

### Extract documents (batch)

```bash
curl -X POST $SCRAPLING/extract/document/batch \
  -F "files=@dok1.pdf" \
  -F "files=@dok2.docx" \
  -F "files=@bilde.jpg"
```

### Health check

```bash
curl $SCRAPLING/health
```

### Quick test against live droplet

```bash
curl -X POST http://164.92.176.42:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "smartout.ai"}'
```

---

## Type Definitions

### Location

```typescript
type Location = {
  id: string;
  name: string;
  type: string; // "Indoor" | "Outdoor"
  function: string;
  isComplete: boolean; // always false (user confirms in wizard)
};
```

### Department

```typescript
type Department = {
  id: string;
  name: string;
  roles: string[];
  description: string;
  isComplete: boolean; // always false (user confirms in wizard)
};
```

### Image

```typescript
type Image = {
  src: string; // absolute URL
  alt: string;
};
```

### Link

```typescript
type Link = {
  href: string; // absolute URL
  text: string;
};
```

---
title: "Worklog — scrapling-extract"
status: in_progress
updated: 2026-03-10
created: 2026-03-10
module: scrapling
tags: [extraction, documents, pdf, docx]
---

# Worklog — scrapling-extract

> Branch: `feat/scrapling-extract` | Worktree: wt-10 | Started: 2026-03-10

## Status: 🟡 In Progress

## Done

- [x] Created extractors module with 7 extractors (pdf, docx, xlsx, csv, txt, image)
- [x] PDF: pymupdf4llm markdown + pymupdf image extraction + pdfplumber table fallback
- [x] DOCX: python-docx with heading detection + table-to-markdown
- [x] XLSX: openpyxl all sheets with markdown tables
- [x] CSV: auto-detect delimiter, encoding detection
- [x] TXT: utf-8/latin-1 encoding detection
- [x] Image: Pillow validation + base64 encode, WEBP→PNG conversion
- [x] Added POST /extract/document endpoint (single file)
- [x] Added POST /extract/document/batch endpoint (multiple files)
- [x] Updated /health endpoint with version + extractor list
- [x] Updated requirements.txt with new dependencies
- [x] Updated Dockerfile with Pillow system deps + extractors directory
- [x] Rewrote edge function to use scrapling instead of local parsing
- [x] Edge function now sends images to Claude API as multimodal content

## Remaining

- [ ] Test Docker build locally
- [ ] Test end-to-end with PDF upload
- [ ] Update SCRAPLING_API.md with new endpoints
- [ ] Write user journey
- [ ] PR to development

## Decisions

| Date       | Decision                                                  | Reason                                                                     |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-03-10 | Use /extract/document instead of /extract for file upload | Existing /extract is URL-based workspace extraction — avoid route conflict |
| 2026-03-10 | Route: /extract/document and /extract/document/batch      | Clear namespace separation between URL scraping and file extraction        |

## Log

| Date       | Time  | Event                                                                |
| ---------- | ----- | -------------------------------------------------------------------- |
| 2026-03-10 | 02:08 | Feature started                                                      |
| 2026-03-10 | 02:30 | All extractors implemented, endpoints added, edge function rewritten |

// ============================================
// v/page.tsx
// Compatibility route for landing admin preview URLs.
// Why: admin currently links to `/v?preview=true&id=...`; this route forwards
// to the same renderer used on `/` so behavior stays consistent.
// ============================================

export { default } from "../page";

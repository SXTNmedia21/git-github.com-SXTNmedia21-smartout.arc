import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  rating?: number;
  ratingCount?: number;
  priceRange?: string;
}

interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date: string;
  source: string;
}

interface SerperKnowledgeGraph {
  title?: string;
  rating?: number;
  ratingCount?: number;
  type?: string;
  description?: string;
}

interface ExternalRating {
  source: string;
  rating: number;
  reviewCount: number | null;
  priceRange: string | null;
  url: string;
}

interface WebSearchResult {
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  externalRatings: ExternalRating[];
  newsArticles: { title: string; url: string; snippet: string }[];
  seasonalPatterns: string[];
  mentions: string[];
  jobListings: string[];
}

const SEASONAL_KEYWORDS = [
  "sommermeny",
  "julebord",
  "påske",
  "vinter",
  "sommer",
  "terrasse",
  "uteservering",
  "sesong",
  "nyttår",
  "valentines",
  "17. mai",
  "sommersesong",
  "vintersesong",
];

const JOB_KEYWORDS = [
  "stilling",
  "ledig",
  "søker",
  "ansette",
  "bartender",
  "kokk",
  "servitør",
  "chef",
  "waiter",
  "sous chef",
  "kjøkkensjef",
  "hovmester",
  "sommelier",
];

function extractSeasonalPatterns(texts: string[]): string[] {
  const found = new Set<string>();
  const joined = texts.join(" ").toLowerCase();
  for (const keyword of SEASONAL_KEYWORDS) {
    if (joined.includes(keyword.toLowerCase())) {
      found.add(keyword);
    }
  }
  return [...found];
}

const RATING_SOURCES: Record<string, string> = {
  "tripadvisor.com": "TripAdvisor",
  "tripadvisor.no": "TripAdvisor",
  "yelp.com": "Yelp",
  "yelp.no": "Yelp",
  "google.com/maps": "Google",
  "thefork.com": "TheFork",
  "thefork.no": "TheFork",
};

function extractExternalRatings(results: SerperOrganicResult[]): ExternalRating[] {
  const ratings: ExternalRating[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (!r.rating) continue;
    for (const [domain, source] of Object.entries(RATING_SOURCES)) {
      if (r.link.includes(domain) && !seen.has(source)) {
        seen.add(source);
        ratings.push({
          source,
          rating: r.rating,
          reviewCount: r.ratingCount || null,
          priceRange: r.priceRange || null,
          url: r.link,
        });
      }
    }
  }
  return ratings;
}

/** Find the company's own website from search results (skip aggregators). */
function extractWebsite(results: SerperOrganicResult[], companyName: string): string | null {
  const skipDomains = [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "tiktok.com",
    "tripadvisor",
    "yelp.com",
    "google.com",
    "proff.no",
    "1881.no",
    "gulesider.no",
    "purehelp.no",
    "brreg.no",
    "finn.no",
    "youtube.com",
    "twitter.com",
    "x.com",
  ];
  const normalName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const r of results) {
    try {
      const url = new URL(r.link);
      const domain = url.hostname.replace(/^www\./, "");
      if (skipDomains.some((s) => domain.includes(s))) continue;

      // Check if domain or title looks like the company
      const normalDomain = domain.replace(/[^a-z0-9]/g, "");
      const normalTitle = r.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalDomain.includes(normalName) || normalTitle.includes(normalName)) {
        return `${url.protocol}//${url.hostname}`;
      }
    } catch {
      // skip malformed URLs
    }
  }
  return null;
}

/** Extract email addresses from search snippets. */
function extractEmail(texts: string[]): string | null {
  const joined = texts.join(" ");
  const match = joined.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
  if (!match) return null;
  // Strip trailing punctuation (period, comma, etc.)
  return match[0].replace(/[.,;:!?)]+$/, "");
}

/** Extract phone numbers (Norwegian format) from search snippets. */
function extractPhone(texts: string[]): string | null {
  const joined = texts.join(" ");
  // Match Norwegian phone: optional +47, then 8 digits with optional spaces
  const patterns = [
    /\+\s?47\s?\d[\d\s]{7,10}\d/, // +47 prefixed
    /(?<!\d)\d{3}\s\d{2}\s\d{3}(?!\d)/, // 941 68 561
    /(?<!\d)\d{2}\s\d{2}\s\d{2}\s\d{2}(?!\d)/, // 94 16 85 61
    /(?<!\d)\d{8}(?!\d)/, // 94168561
  ];
  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (match) {
      const digits = match[0].replace(/[\s+]/g, "");
      const clean = digits.replace(/^47/, "");
      if (clean.length === 8) return match[0].trim();
    }
  }
  return null;
}

function extractJobListings(results: SerperOrganicResult[]): string[] {
  const jobs: string[] = [];
  for (const r of results) {
    const text = `${r.title} ${r.snippet}`.toLowerCase();
    for (const keyword of JOB_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        jobs.push(r.title);
        break;
      }
    }
  }
  return jobs.slice(0, 5);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ADR-0029 / F-EF-03: reject anonymous callers — service-role or cron bearer only.
  // Called EF-to-EF from gather-workspace-intelligence (already service-role signed).
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) {
    console.warn("[web-search-intelligence] auth_failure: missing or invalid bearer");
    return authResult.response;
  }

  try {
    const { companyName, city } = await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: "companyName is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get("SERPER_API_KEY");
    if (!apiKey) {
      console.warn("SERPER_API_KEY not configured, returning empty results");
      const empty: WebSearchResult = {
        rating: null,
        reviewCount: null,
        website: null,
        email: null,
        phone: null,
        externalRatings: [],
        newsArticles: [],
        seasonalPatterns: [],
        mentions: [],
        jobListings: [],
      };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const searchQuery = `"${companyName}" ${city || ""}`.trim();
    const headers = {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    };

    console.log(`[web-search] Querying Serper for: "${searchQuery}"`);

    const contactQuery = `"${companyName}" email kontakt telefon`;

    // Run search + news + contact search in parallel
    const [searchRes, newsRes, contactRes] = await Promise.all([
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: searchQuery, gl: "no", hl: "no", num: 10 }),
      })
        .then((r) => {
          if (!r.ok) {
            console.warn(`[web-search] Serper search returned ${r.status}`);
            return null;
          }
          return r.json();
        })
        .catch((e) => {
          console.warn("[web-search] Serper search error:", e);
          return null;
        }),
      fetch("https://google.serper.dev/news", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: searchQuery, gl: "no", hl: "no", num: 5 }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: contactQuery, gl: "no", hl: "no", num: 5 }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const organic: SerperOrganicResult[] = searchRes?.organic || [];
    const contactOrganic: SerperOrganicResult[] = contactRes?.organic || [];
    const kg: SerperKnowledgeGraph | null = searchRes?.knowledgeGraph || null;
    const news: SerperNewsResult[] = newsRes?.news || [];

    console.log(
      `[web-search] Got ${organic.length} organic, ${contactOrganic.length} contact, ${news.length} news`,
    );
    if (organic.length > 0) {
      console.log(`[web-search] Top result: ${organic[0].title} → ${organic[0].link}`);
    }

    const allSnippets = [
      ...organic.map((r) => r.snippet),
      ...contactOrganic.map((r) => r.snippet),
      ...news.map((r) => r.snippet),
    ];

    const externalRatings = extractExternalRatings(organic);

    const website = extractWebsite(organic, companyName);
    const email = extractEmail(allSnippets);
    const phone = extractPhone(allSnippets);
    console.log(`[web-search] Extracted website: ${website}, email: ${email}, phone: ${phone}`);

    const result: WebSearchResult = {
      rating: kg?.rating || null,
      reviewCount: kg?.ratingCount || null,
      website,
      email,
      phone,
      externalRatings,
      newsArticles: news.map((n) => ({
        title: n.title,
        url: n.link,
        snippet: n.snippet,
      })),
      seasonalPatterns: extractSeasonalPatterns(allSnippets),
      mentions: organic.slice(0, 5).map((r) => r.snippet),
      jobListings: extractJobListings(organic),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Web search error:", error);
    // Return empty results on error — web search is nice-to-have
    return new Response(
      JSON.stringify({
        rating: null,
        reviewCount: null,
        website: null,
        email: null,
        phone: null,
        externalRatings: [],
        newsArticles: [],
        seasonalPatterns: [],
        mentions: [],
        jobListings: [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});

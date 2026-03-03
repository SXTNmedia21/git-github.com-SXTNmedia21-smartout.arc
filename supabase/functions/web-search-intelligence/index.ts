import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
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

interface WebSearchResult {
  rating: number | null;
  reviewCount: number | null;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyName, city } = await req.json();

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: "companyName is required." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const apiKey = Deno.env.get("SERPER_API_KEY");
    if (!apiKey) {
      console.warn("SERPER_API_KEY not configured, returning empty results");
      const empty: WebSearchResult = {
        rating: null,
        reviewCount: null,
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

    // Run search + news in parallel
    const [searchRes, newsRes] = await Promise.all([
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: searchQuery, gl: "no", hl: "no", num: 10 }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("https://google.serper.dev/news", {
        method: "POST",
        headers,
        body: JSON.stringify({ q: searchQuery, gl: "no", hl: "no", num: 5 }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    const organic: SerperOrganicResult[] = searchRes?.organic || [];
    const kg: SerperKnowledgeGraph | null = searchRes?.knowledgeGraph || null;
    const news: SerperNewsResult[] = newsRes?.news || [];

    const allSnippets = [
      ...organic.map((r) => r.snippet),
      ...news.map((r) => r.snippet),
    ];

    const result: WebSearchResult = {
      rating: kg?.rating || null,
      reviewCount: kg?.ratingCount || null,
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

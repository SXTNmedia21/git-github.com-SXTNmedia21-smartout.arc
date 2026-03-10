import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OcrParsedData {
  total_sales: number | null;
  card_total: number | null;
  cash_total: number | null;
  vat_amount: number | null;
  transaction_count: number | null;
}

// Financial parser — regex patterns for Norwegian POS/terminal output
function parseFinancialData(rawText: string): OcrParsedData {
  const patterns = {
    total_sales: [
      /(?:TOTAL|TOTALT|SUM|OMSETNING)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i,
      /(?:Total\s+salg|Dagssalg)\s*:?\s*([\d\s]+[.,]\d{2})/i,
    ],
    card_total: [
      /(?:KORT|CARD|VISA|MASTERCARD|BANK)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i,
      /(?:Korttransaksjoner|Kortbetaling)\s*:?\s*([\d\s]+[.,]\d{2})/i,
    ],
    cash_total: [/(?:KONTANT|CASH|KONTANTER)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i],
    vat_amount: [/(?:MVA|VAT|MOMS)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i],
    transaction_count: [/(?:ANTALL|COUNT|TRANSAKSJONER|Trans)\s*:?\s*(\d+)/i],
  };

  function extractFirst(patternList: RegExp[]): number | null {
    for (const pattern of patternList) {
      const match = rawText.match(pattern);
      if (match?.[1]) {
        const cleaned = match[1].replace(/\s/g, "").replace(",", ".");
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
    }
    return null;
  }

  return {
    total_sales: extractFirst(patterns.total_sales),
    card_total: extractFirst(patterns.card_total),
    cash_total: extractFirst(patterns.cash_total),
    vat_amount: extractFirst(patterns.vat_amount),
    transaction_count: extractFirst(patterns.transaction_count),
  };
}

// Calculate confidence based on how many fields were extracted
function calculateConfidence(parsed: OcrParsedData): number {
  const fields = [
    parsed.total_sales,
    parsed.card_total,
    parsed.cash_total,
    parsed.vat_amount,
    parsed.transaction_count,
  ];
  const extracted = fields.filter((f) => f !== null).length;
  return extracted / fields.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_id } = await req.json();
    if (!image_id) {
      return new Response(JSON.stringify({ error: "image_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch image record
    const { data: image, error: fetchErr } = await supabase
      .from("settlement_image")
      .select("*")
      .eq("image_id", image_id)
      .single();

    if (fetchErr || !image) {
      return new Response(JSON.stringify({ error: "Image not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Download image from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("settlements")
      .download(image.storage_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Run OCR via Google Vision API
    const imageBytes = await fileData.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBytes)));

    const visionApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!visionApiKey) {
      return new Response(JSON.stringify({ error: "OCR not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
      },
    );

    const visionResult = await visionResponse.json();
    const rawText = visionResult.responses?.[0]?.fullTextAnnotation?.text ?? "";

    // 4. Parse financial data
    const parsed = parseFinancialData(rawText);
    const confidence = calculateConfidence(parsed);

    // 5. Store results
    const { error: updateErr } = await supabase
      .from("settlement_image")
      .update({
        ocr_raw_text: rawText,
        ocr_parsed: parsed,
        ocr_confidence: confidence,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq("image_id", image_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to store OCR results" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        image_id,
        confidence,
        parsed,
        raw_text_length: rawText.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

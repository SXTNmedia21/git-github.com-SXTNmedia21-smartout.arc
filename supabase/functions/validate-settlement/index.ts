import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default tolerance: 1% or 50 NOK, whichever is greater
const DEFAULT_TOLERANCE_PERCENT = 1.0;
const DEFAULT_TOLERANCE_ABSOLUTE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authCheck = verifyInternalAuth(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const { reconciliation_id } = await req.json();
    if (!reconciliation_id) {
      return new Response(JSON.stringify({ error: "reconciliation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch reconciliation
    const { data: recon, error: reconErr } = await supabase
      .from("daily_reconciliation")
      .select("*")
      .eq("reconciliation_id", reconciliation_id)
      .single();

    if (reconErr || !recon) {
      return new Response(JSON.stringify({ error: "Reconciliation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch all settlement images with OCR results
    const { data: images, error: imgErr } = await supabase
      .from("settlement_image")
      .select("*")
      .eq("reconciliation_id", reconciliation_id)
      .not("ocr_parsed", "is", null);

    if (imgErr) {
      return new Response(JSON.stringify({ error: "Failed to fetch images" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ error: "No OCR results available for validation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Find POS and terminal images
    const posImage = images.find((img: Record<string, unknown>) => img.source_type === "pos");
    const terminalImage = images.find(
      (img: Record<string, unknown>) => img.source_type === "terminal",
    );

    if (!posImage || !terminalImage) {
      return new Response(
        JSON.stringify({
          error: "Both POS and terminal images required for validation",
          has_pos: !!posImage,
          has_terminal: !!terminalImage,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Extract totals from OCR data
    const posTotal = (posImage.ocr_parsed as Record<string, unknown>)?.total_sales as number | null;
    const terminalTotal = (terminalImage.ocr_parsed as Record<string, unknown>)?.total_sales as
      | number
      | null;

    if (posTotal === null || terminalTotal === null) {
      return new Response(
        JSON.stringify({
          error: "Could not extract totals from OCR data",
          pos_total: posTotal,
          terminal_total: terminalTotal,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Calculate difference
    const difference = Math.abs(posTotal - terminalTotal);
    const maxTotal = Math.max(posTotal, terminalTotal);
    const differencePercent = maxTotal > 0 ? (difference / maxTotal) * 100 : 0;

    // 6. Check against tolerance (percentage OR absolute)
    const toleranceAbsolute = DEFAULT_TOLERANCE_ABSOLUTE;
    const tolerancePercent = DEFAULT_TOLERANCE_PERCENT;
    const withinThreshold =
      difference <= toleranceAbsolute || differencePercent <= tolerancePercent;

    // 7. Create settlement_validation record
    const { data: validation, error: valErr } = await supabase
      .from("settlement_validation")
      .insert({
        reconciliation_id,
        workspace_id: recon.workspace_id,
        pos_total: posTotal,
        terminal_total: terminalTotal,
        difference,
        difference_percent: differencePercent,
        within_threshold: withinThreshold,
      })
      .select()
      .single();

    if (valErr) {
      return new Response(JSON.stringify({ error: "Failed to create validation record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. If mismatch exceeds threshold → create deviation
    let deviationId: string | null = null;
    if (!withinThreshold) {
      const { data: deviation, error: devErr } = await supabase
        .from("deviation")
        .insert({
          workspace_id: recon.workspace_id,
          department_id: recon.department_id,
          session_id: recon.session_id,
          reconciliation_id,
          domain: "system",
          subcategory: "settlement_mismatch",
          severity: differencePercent > 5 ? "high" : "medium",
          title: `Settlement mismatch: ${difference.toFixed(2)} NOK (${differencePercent.toFixed(1)}%)`,
          description: `POS total: ${posTotal.toFixed(2)} NOK, Terminal total: ${terminalTotal.toFixed(2)} NOK. Difference exceeds threshold.`,
          blocks_day_approval: differencePercent > 5,
          requires_action: true,
        })
        .select("deviation_id")
        .single();

      if (!devErr && deviation) {
        deviationId = deviation.deviation_id;

        // Update validation with deviation reference
        await supabase
          .from("settlement_validation")
          .update({ deviation_id: deviationId })
          .eq("validation_id", validation.validation_id);
      }
    }

    // 9. Update reconciliation with revenue data (from POS, which is source of truth)
    const posOcr = posImage.ocr_parsed as Record<string, unknown>;
    await supabase
      .from("daily_reconciliation")
      .update({
        status: "awaiting_approval",
        revenue_total: posTotal,
        revenue_card: (posOcr?.card_total as number) ?? null,
        revenue_cash: (posOcr?.cash_total as number) ?? null,
        revenue_vat: (posOcr?.vat_amount as number) ?? null,
        revenue_transactions: (posOcr?.transaction_count as number) ?? null,
        revenue_source: "ocr",
        updated_at: new Date().toISOString(),
      })
      .eq("reconciliation_id", reconciliation_id);

    return new Response(
      JSON.stringify({
        reconciliation_id,
        validation_id: validation.validation_id,
        pos_total: posTotal,
        terminal_total: terminalTotal,
        difference,
        difference_percent: differencePercent,
        within_threshold: withinThreshold,
        deviation_id: deviationId,
        status: "awaiting_approval",
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

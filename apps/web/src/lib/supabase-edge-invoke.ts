/**
 * Safe wrapper around supabase.functions.invoke() that detects when Edge Runtime
 * is down (503) and surfaces a clear, actionable error message.
 *
 * Why: In local dev, supabase_edge_runtime can stop silently. All Edge Function
 * calls then return 503 with no useful message. This wrapper catches that and
 * tells the developer exactly what happened and how to fix it.
 */

import type { SupabaseClient, FunctionInvokeOptions } from "@supabase/supabase-js";
import { toast } from "sonner";

const EDGE_RUNTIME_DOWN_MSG =
  "Edge Functions er ikke tilgjengelig. Supabase Edge Runtime kjører ikke.\n\n" +
  "Kjør i terminalen: docker start supabase_edge_runtime_smartout.ai";

let hasShownEdgeDownToast = false;

/**
 * Invokes a Supabase Edge Function with 503 detection.
 *
 * On 503 or network failure, shows a toast once per session and throws a
 * developer-friendly error instead of the generic Supabase error.
 */
export async function invokeEdgeFunction<T = unknown>(
  supabase: SupabaseClient,
  functionName: string,
  options?: FunctionInvokeOptions,
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await supabase.functions.invoke<T>(functionName, options);

    // Supabase client wraps non-2xx as FunctionsHttpError with context property
    if (result.error) {
      const errMsg = result.error.message ?? "";
      const is503 =
        errMsg.includes("503") ||
        errMsg.includes("Service Temporarily Unavailable") ||
        errMsg.includes("non-2xx") ||
        errMsg.includes("ECONNREFUSED");

      if (is503) {
        showEdgeDownToast(functionName);
        return {
          data: null,
          error: new Error(
            `Edge Function "${functionName}" er utilgjengelig. ` +
              "Start Edge Runtime: docker start supabase_edge_runtime_smartout.ai",
          ),
        };
      }
    }

    return result as { data: T | null; error: Error | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNetworkError =
      message.includes("Failed to fetch") ||
      message.includes("ECONNREFUSED") ||
      message.includes("503") ||
      message.includes("NetworkError");

    if (isNetworkError) {
      showEdgeDownToast(functionName);
      return {
        data: null,
        error: new Error(
          `Edge Function "${functionName}" er utilgjengelig. ` +
            "Start Edge Runtime: docker start supabase_edge_runtime_smartout.ai",
        ),
      };
    }

    return { data: null, error: err instanceof Error ? err : new Error(message) };
  }
}

function showEdgeDownToast(functionName: string) {
  if (hasShownEdgeDownToast) return;
  hasShownEdgeDownToast = true;

  if (process.env.NODE_ENV === "development") {
    toast.error("Edge Functions nede", {
      description: `"${functionName}" returnerte 503. Kjør: docker start supabase_edge_runtime_smartout.ai`,
      duration: 15_000,
    });
  }
}

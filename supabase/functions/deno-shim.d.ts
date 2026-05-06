/**
 * deno-shim.d.ts
 *
 * Minimal typings for Edge Function sources when the editor uses the
 * workspace TypeScript language service instead of the Deno extension.
 * Runtime is still Deno inside `supabase functions serve` / deployed functions.
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

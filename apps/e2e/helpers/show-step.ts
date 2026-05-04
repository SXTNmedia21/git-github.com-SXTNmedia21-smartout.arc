import type { Page } from "@playwright/test";

/**
 * Renders a visible banner at the top of the browser showing the current
 * journey + step. Used to give Pontus (or anyone watching) a readable trail
 * of what the E2E is doing during a slow headed run.
 *
 * After rendering the banner, waits `dwellMs` so the eye can register it.
 * Default dwell is 700ms — enough to read a short sentence without being
 * annoying on a 15-journey suite.
 */
export async function showStep(page: Page, journey: string, step: string, dwellMs = 700) {
  await page
    .evaluate(
      ({ j, s }) => {
        let bar = document.getElementById("e2e-banner");
        if (!bar) {
          bar = document.createElement("div");
          bar.id = "e2e-banner";
          bar.style.cssText = [
            "position:fixed",
            "top:0",
            "left:0",
            "right:0",
            "z-index:2147483647",
            "padding:10px 18px",
            "background:#1c1814",
            "color:#f5f1ea",
            "font:600 13px/1.3 ui-sans-serif,system-ui,-apple-system,Geist,sans-serif",
            "border-bottom:2px solid #f97316",
            "box-shadow:0 4px 16px rgba(0,0,0,0.2)",
            "display:flex",
            "gap:14px",
            "align-items:center",
            "pointer-events:none",
          ].join(";");
          document.body.appendChild(bar);
        }
        bar.innerHTML =
          '<span style="font:700 10px/1 ui-monospace,Geist Mono,monospace;letter-spacing:0.14em;text-transform:uppercase;color:#f97316;padding:2px 6px;background:rgba(249,115,22,0.14);border-radius:4px;">' +
          j +
          "</span>" +
          '<span style="color:#f5f1ea;">' +
          s +
          "</span>";
      },
      { j: journey, s: step },
    )
    .catch(() => {
      /* page may have navigated mid-step; re-render on next call */
    });
  await page.waitForTimeout(dwellMs);
}

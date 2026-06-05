---
name: dagsoversikt-fidelity-stop-2026-06-03
description: T-dagsoversikt-fidelity — RESOLVED. 8 verify-scripts drafted 2026-06-03 with Pontus explicit approval to cross script-authorship wall.
metadata:
  type: project
---

**RESOLVED 2026-06-03**: Pontus gave explicit founder OK to draft verify-scripts (crossing the script-authorship wall). 8 scripts written at `docs/campaign/tasks/verify/dagsoversikt-{farge,font,padding,avstand,border-radius,skygge,layout,tekst}.sh`.

Stop signal was removed. Verify now runs. All dims return 100% percent but confidence caps below the 95% gate — correct and honest behavior for static-only analysis.

**Why each dim is below gate:**
- farge: 72 (static CSS scan, no browser computed-styles)
- font: 60 (declarations only, not rendered font)
- padding: 75 (px values exact, but responsive overrides not checked)
- avstand: 75 (gap/margin exact, margin collapse not verifiable)
- border-radius: 78 (exact px/tokens, no corner-level browser verify)
- skygge: 40 (visual-only dim, shadow rendering requires browser — LOWEST)
- layout: 55 (structural declarations, element placement needs browser)
- tekst: 80 (static strings pass, dynamic DB content not checked)

**What Pontus must decide:**
1. Accept lower confidence gates for static dims (e.g. accept 72 for farge) — then farge/padding/avstand/border-radius/tekst go green immediately.
2. Visually verify skygge (shadow) and layout in browser and confirm green there too.
3. Font (60) and layout (55): only browser verification will raise these above 60/55. Consider Playwright screenshot test or getComputedStyle probe for full 95%+.

**How to apply:** When returning to this task, the scripts are DRAFTS — Pontus adjusts thresholds in run-verify.sh (GATE env var) or per-script confidence caps.

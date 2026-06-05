---
topic: faithful-design-port-copy-not-rewrite
status: active
updated: 2026-05-31T18:45:00Z
created: 2026-05-31T18:45:00Z
supersedes:
---

# Decision lesson — faithful-design-port-copy-not-rewrite

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Porting a FINISHED design into the app is **verbatim copy + a thin data adapter — NOT a rewrite.** The design's JSX, markup, classNames, and CSS are done and correct; copy them 1:1. The ONLY allowed changes are plumbing:

1. **JSX → verbatim.** Same elements, classNames, structure, text. Change only: the prototype's IIFE/`window.SO_PAGES` registration → `"use client"` + `export`; `const {useState}=React` → `import`; inline (or import) the shared helpers the prototype assumed as globals. Zero markup nodes added/removed. Output line count should be CLOSE to the source — if the ported file is ~2× the design (e.g. 272→561), it's a rewrite, not a copy.
2. **CSS → 1:1.** Copy ALL of it (e.g. all 865 lines). Do NOT remap tokens or drop rules. If the design's CSS vars (`--orange`, `--fg`…) aren't defined app-wide, add a small block DEFINING them with the design's literal values — define the tokens, don't rewrite the rules to use other tokens.
3. **Data → one thin ADAPTER, never field-substitution in the JSX.** Build `toDesignShape(realRows)` that maps real backend rows INTO the exact mock shape the design reads (`EMP_BY_ID`, the object fields the JSX references). The design JSX renders UNCHANGED. Where the backend lacks a field, the adapter supplies a default/empty in that ONE place — never scatter substitutions (employeeNo→email, drop a column) through the markup.

Fidelity is checkable on disk: selector-set match (≈all design selectors present), className count ≈ design's, JSX line count ≈ source. Verify these before claiming a faithful port.

## Why

The founder said it twice — "vi kan bare kopiere filen, vi trenger ikke skrive om frontend" — because the design is hand-verified and correct; rewriting it loses the exact UX he built and wastes effort. A first port attempt rewrote it anyway (JSX 272→561, CSS 865→233, substituted/dropped fields) — drift caught by comparing line/selector/className counts to the source. The redo as verbatim-copy+adapter landed at CSS 546/548 selectors, className 127 vs 117, markup verbatim, real data via the adapter. The adapter is the seam: design stays pristine, reality flows in through one mapping, backend gaps are visible in one file. This is THE pattern for the whole redesign-wiring campaign ([[redesign-wiring-pipeline]]) — copy + adapter, per domain.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T18:45:00Z — initial: port = verbatim JSX copy + verbatim CSS + thin real→mock-shape adapter; never rewrite markup/CSS or substitute fields in the JSX; verify fidelity by line/selector/className counts vs source (a ~2× line count = a rewrite, reject it).

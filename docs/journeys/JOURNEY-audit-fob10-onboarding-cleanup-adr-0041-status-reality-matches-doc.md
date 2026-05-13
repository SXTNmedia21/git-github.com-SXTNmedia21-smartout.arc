---
title: "Journey — ADR-0041 status reality matches doc"
feature: audit-fob10-onboarding-cleanup
journey: adr-0041-status-reality-matches-doc
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: onboarding
tags: [journey, adr, closure, governance]
---

# Journey: ADR-0041 frontmatter status matches actual code state

**Role:** future auditor or developer reading ADR-0041

**Precondition:** Pre-this-sortie ADR-0041 carries `status: superseded` (or similar) but code still has legacy onboarding files. Mismatch.

## Happy Path

1. Reader opens `docs/decisions/0041-*.md`
2. Frontmatter `status: superseded` matches reality — code has no legacy scroll-wizard files
3. New section "## 2026-05-13 Legacy code removal — F-OB-10-01 closure" documents:
   - audit ref (2026-05-13 F-OB-10-01)
   - branch ref (feat/audit-fob10-onboarding-cleanup)
   - migration sortie that made supersession real
4. Optionally ADR-0304 (proposed) governs the rule: "Superseded ADRs MUST delete code by close of sortie"
5. Audit synthesis F-OB-10-01 row points to this ADR amendment

**Postcondition:** ADR governance + code state coherent. F-OB-10-01 closed in synthesis.

## Error Paths

- **ADR-0041 has no `status: superseded` to begin with** → adjust closure narrative to "Phase E moved /onboarding to AnimatedWizardShell; legacy files cleared 2026-05-13"
- **No prior ADR governs the superseded-ADR rule** → ADR-0304 draft optional, not required

## Verification

- [ ] ADR-0041 amended with closure section
- [ ] Audit synthesis F-OB-10-01 row marked CLOSED with branch ref
- [ ] Optionally ADR-0304 drafted + registered in decision-log

**Mark `status: verified` when all three checked.**

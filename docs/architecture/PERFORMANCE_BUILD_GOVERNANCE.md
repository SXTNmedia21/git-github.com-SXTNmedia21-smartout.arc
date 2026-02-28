# Performance and Build Governance Architecture

## Purpose

Define the permanent architecture for keeping Smartout fast and build-safe as the codebase grows.

This architecture complements ADR-0019 and operationalizes speed/efficiency through CI gates, route budgets, and documentation-first ownership.

## System Components

### 1) Governance Layer

- `docs/cross-cutting/performance-governance.md`
- `docs/cross-cutting/performance-checklist.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

Responsibilities:

- Define route budget policy and escalation
- Define exemption model (reason, owner, expiry)
- Enforce review behavior in PRs

### 2) Budget Layer

- `apps/web/perf-budgets.json`
- `apps/landing/perf-budgets.json`

Responsibilities:

- Versioned route-level thresholds
- Explicit contract for acceptable response time and HTML payload per route

### 3) Measurement Layer

- `scripts/perf/audit.mjs`

Responsibilities:

- Measure route response and payload metrics
- Compare against budget contract
- Emit machine-readable and markdown artifacts

### 4) Build Health Layer

- `scripts/quality/build-health-check.mjs`

Responsibilities:

- Catch deterministic build integrity risks early
- Block known harmful patterns (e.g., hardcoded localhost URLs)
- Report non-blocking warning signals for architecture review

### 5) CI Enforcement Layer

- `.github/workflows/ci.yml`

Responsibilities:

- Run budget and build-health checks continuously
- Apply phased enforcement:
  - pull requests: `warn`
  - push to integration branch: `fail`

## Design Principles

1. **Server-first by default**  
   Push client boundaries as deep as possible.

2. **Measure before enforcing**  
   Start with report/warn mode, then fail mode after baseline stability.

3. **Deterministic CI signals**  
   Prefer stable metrics and low-flake automation.

4. **Ownership and expiry over permanent exceptions**  
   Every exemption needs owner + expiry.

5. **Architecture over heroics**  
   Prefer structural fixes (split boundaries, lazy-load heavy modules, reduce render surfaces) over tactical patches.

## Control Loops

### Fast feedback loop (PR)

Developer change -> CI checks -> artifacts + warnings -> fix before merge.

### Hard-stop loop (integration branch)

Push -> CI fail mode -> regression blocked until budget/build-health passes.

## Known Hotspots

- Dashboard shell and global client layout boundaries
- Schedule DnD render surface and per-cell overhead
- Landing pages with broad client rendering and expensive visual effects

## Future Extensions

- Add optional Lighthouse/Web Vitals collection in nightly jobs
- Add per-route JavaScript transfer budget once deterministic bundle extraction is stable in CI
- Add trend dashboards from `artifacts/perf/*.json` into observability tooling

## References

- ADR: `docs/decisions/0019-performance-build-governance.md`
- Governance: `docs/cross-cutting/performance-governance.md`
- Checklist: `docs/cross-cutting/performance-checklist.md`

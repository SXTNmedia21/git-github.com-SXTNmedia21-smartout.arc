### D-001: Shared admin gate was the repeated latency source

**Found:** 2026-03-06
**Context:** Platform-admin pages still felt slow after dashboard-only optimizations.
**Finding:** The `is_godmode` lookup path was repeatedly hit across `/platform-admin/*` navigation paths, so latency was not isolated to one page.
**Implication:** Cross-page auth checks need short-lived caching to improve perceived responsiveness in admin areas.
**Status:** New

### D-002: Interface State Architecture for Wizards

**Found:** 2026-03-06
**Context:** Brainstorming the Dashboard Setup Wizard.
**Finding:** Hard-coding focus modes (hiding sidebar/nav) into individual wizards is brittle. A global `interfaceState` (NORMAL, FOCUS_SOFT, FOCUS_HARD) provides a clean, reusable gate.
**Implication:** We can enforce critical compliance steps (Hard Gate) and support deep-work tasks (Soft Gate) consistently across the entire app by updating the `DashboardShell`.
**Status:** New

### D-003: Voice employee lookup breaks on spelling variants

**Found:** 2026-03-06
**Context:** Schedule voice assistant could not find an employee visible in UI.
**Finding:** Seed data used `Aleksander Bryn`, while spoken/query form used `Alexander Bryn`; strict lowercase substring match failed.
**Implication:** Employee lookup for voice flows must normalize Nordic characters and common transliteration variants before matching.
**Status:** New

### E-001: Session API call order can throw while disconnected

**Found:** 2026-03-06
**Context:** Voice assistant startup emitted `Cannot set output medium while not connected`.
**Finding:** `setOutputMedium("text")` was called before confirmed connection state.
**Implication:** Audio/output state transitions must be guarded by connection readiness to avoid startup errors.
**Status:** New

### A-001: Ghost cards for agent-initiated shift changes

**Found:** 2026-03-06
**Context:** User requested human-in-the-loop for agent shift mutations.
**Finding:** Agent createShift/updateShift currently apply changes directly. No proposal/approval layer exists.
**Implication:** Need proposal data model (ghost cards) and approval UI; agent tools should create proposals instead of mutating directly.
**Status:** New

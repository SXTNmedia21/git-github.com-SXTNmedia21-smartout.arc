import { useState, useCallback } from "react";

// ─── Data ───────────────────────────────────────────────────────────
const MODULES = [
  { id: "core", name: "Core", icon: "🔑", color: "#6366f1" },
  { id: "scheduling", name: "Scheduling", icon: "📅", color: "#0ea5e9" },
  { id: "operations", name: "Operations", icon: "⚡", color: "#f59e0b" },
  { id: "haccp", name: "HACCP", icon: "🌡️", color: "#ef4444" },
  { id: "training", name: "Training", icon: "🎓", color: "#8b5cf6" },
  { id: "communication", name: "Communication", icon: "💬", color: "#10b981" },
  { id: "payroll", name: "Payroll", icon: "💰", color: "#f97316" },
  { id: "season", name: "Season", icon: "🏆", color: "#eab308" },
  { id: "governance", name: "Governance", icon: "📜", color: "#64748b" },
  { id: "org", name: "Org Structure", icon: "🏢", color: "#06b6d4" },
];

const STATUSES = [
  { id: "draft", label: "Draft", color: "#94a3b8", bg: "#f1f5f9", icon: "✏️" },
  { id: "defined", label: "Defined", color: "#6366f1", bg: "#eef2ff", icon: "📋" },
  { id: "implementing", label: "Implementing", color: "#f59e0b", bg: "#fffbeb", icon: "🔨" },
  { id: "testing", label: "Testing", color: "#8b5cf6", bg: "#f5f3ff", icon: "🧪" },
  { id: "live", label: "Live", color: "#10b981", bg: "#ecfdf5", icon: "✅" },
  { id: "broken", label: "Broken", color: "#ef4444", bg: "#fef2f2", icon: "🔴" },
];

const ACTORS = [
  { id: "employee", label: "Ansatt", color: "#3b82f6" },
  { id: "admin", label: "Admin/Leder", color: "#f59e0b" },
  { id: "owner", label: "Eier", color: "#8b5cf6" },
  { id: "trainee", label: "Trainee", color: "#10b981" },
  { id: "all", label: "Alle", color: "#6b7280" },
];

const PLATFORMS = [
  { id: "mobile", label: "📱 Mobile" },
  { id: "desktop", label: "🖥️ Desktop" },
  { id: "both", label: "🖥️📱 Both" },
];

const PRIORITIES = [
  { id: "P0", label: "P0 Critical", color: "#ef4444" },
  { id: "P1", label: "P1 Important", color: "#f59e0b" },
  { id: "P2", label: "P2 Nice to have", color: "#6b7280" },
];

const OUTPUT_TYPES = [
  { id: "e2e", icon: "🧪", label: "E2E Test", desc: "Playwright/Detox skeleton" },
  { id: "doc", icon: "📖", label: "Onboarding Doc", desc: "Employee-facing guide page" },
  { id: "linear", icon: "🔲", label: "Linear Issue", desc: "Full spec with acceptance criteria" },
  { id: "botsson", icon: "🤖", label: "Mr. Botsson Script", desc: "Voice walkthrough script" },
];

const INITIAL_JOURNEYS = [
  {
    id: "j-001", title: "Sign Up & Create Workspace", module: "core", actor: "owner",
    trigger: "Landing page → Sign up", platform: "desktop", priority: "P0", status: "live",
    steps: ["Enter email/password → Create account", "AI scrapes website + Brønnøysund → Prepopulate workspace", "Confirm/adjust company details", "Mr. Botsson guides 7-stage setup wizard", "Workspace ready → Invite first employees"],
    testAssertion: "signup → workspace exists → setup wizard completes → can invite",
    docTitle: "Your first 10 minutes with Smartout",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: "2026-02-28T14:30:00", lastTestResult: "pass", createdAt: "2026-01-15",
  },
  {
    id: "j-002", title: "Employee Accepts Invite", module: "core", actor: "employee",
    trigger: "Email/SMS invite link", platform: "mobile", priority: "P0", status: "live",
    steps: ["Click invite → Create account or link existing", "Land in Trainee Mode (sandbox)", "AI greets → Profile setup (photo, language, emergency)", "Navigation tour → Core concepts intro", "Module journeys begin based on first shift needs"],
    testAssertion: "invite sent → account created → trainee mode active → AI greeting shown",
    docTitle: "Welcome to your new workplace",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: "2026-02-28T14:30:00", lastTestResult: "pass", createdAt: "2026-01-15",
  },
  {
    id: "j-003", title: "Login & Route to Context", module: "core", actor: "all",
    trigger: "Open app / navigate to site", platform: "both", priority: "P0", status: "implementing",
    steps: ["Auth check → Route by role + state", "Employee on shift → Feed (Home tab)", "Employee off shift → Schedule view", "Admin → Dashboard overview", "Trainee → Onboarding progress"],
    testAssertion: "login as each role → correct screen rendered → context matches state",
    docTitle: "", outputs: { e2e: true, doc: false, linear: true, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-01",
  },
  {
    id: "j-004", title: "Check My Schedule", module: "scheduling", actor: "employee",
    trigger: "Open app → Vakter tab", platform: "mobile", priority: "P0", status: "live",
    steps: ["See week/month calendar with my shifts highlighted", "Tap shift → See detail (time, location, role, team, procedures)", "See who else is working that shift", "Empty state: 'Ingen vakter denne uken'"],
    testAssertion: "open schedule → shifts visible → tap → detail correct → colleagues listed",
    docTitle: "Checking when you work next",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: "2026-02-27T09:15:00", lastTestResult: "pass", createdAt: "2026-01-20",
  },
  {
    id: "j-005", title: "Register Availability", module: "scheduling", actor: "employee",
    trigger: "Vakter tab → Min tilgjengelighet", platform: "mobile", priority: "P0", status: "testing",
    steps: ["Open availability calendar", "Mark dates/times as unavailable", "Or: Request time off → Select dates → Add reason", "Submit → Manager notified", "See status: pending / approved / rejected"],
    testAssertion: "mark unavailable → saved → visible in admin grid → conflict detected if shift exists",
    docTitle: "Tell your manager when you can't work",
    outputs: { e2e: true, doc: true, linear: true, botsson: false },
    lastTestRun: "2026-02-28T11:00:00", lastTestResult: "fail", createdAt: "2026-02-01",
  },
  {
    id: "j-006", title: "Claim Open Shift", module: "scheduling", actor: "employee",
    trigger: "Push notification or Vakter → Ledige vakter", platform: "mobile", priority: "P1", status: "defined",
    steps: ["See list of unassigned shifts", "Filter by date, department, skill match", "Tap 'Ta vakten' → Express interest", "Manager approves/rejects", "Shift appears in my schedule"],
    testAssertion: "open shift posted → employee claims → manager approves → shift assigned",
    docTitle: "Pick up extra shifts",
    outputs: { e2e: false, doc: true, linear: true, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-10",
  },
  {
    id: "j-007", title: "Request Shift Swap", module: "scheduling", actor: "employee",
    trigger: "Shift detail → Foreslå bytte", platform: "mobile", priority: "P1", status: "draft",
    steps: ["Select shift to swap", "See eligible colleagues (skill + availability)", "Select colleague → Send swap request", "Colleague accepts/declines", "Manager approves → Shifts swapped"],
    testAssertion: "request swap → colleague notified → accepts → manager approves → schedules updated",
    docTitle: "Swap a shift with a colleague",
    outputs: { e2e: false, doc: false, linear: false, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-20",
  },
  {
    id: "j-008", title: "Build Weekly Schedule", module: "scheduling", actor: "admin",
    trigger: "Desktop → Schedule Builder", platform: "desktop", priority: "P0", status: "implementing",
    steps: ["Open drag-and-drop grid (employee/position/team × days)", "Create shifts from templates or custom", "Assign employees (availability + skill + cost overlay)", "Handle conflicts (overtime, rest time, skill gaps)", "Review cost per day → Publish schedule", "All employees notified"],
    testAssertion: "create shifts → assign → validate no conflicts → publish → employees see shifts",
    docTitle: "Planning next week's schedule",
    outputs: { e2e: true, doc: true, linear: true, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-01-25",
  },
  {
    id: "j-009", title: "Handle Sick Call", module: "scheduling", actor: "admin",
    trigger: "Notification: employee meldte seg syk", platform: "both", priority: "P0", status: "defined",
    steps: ["See affected shift details", "System suggests replacement (available + qualified)", "One-tap: Send request to suggested employee", "Employee confirms → Shift reassigned", "Or: Post as open shift"],
    testAssertion: "sick call → replacement suggested → sent → confirmed → schedule updated",
    docTitle: "Covering a sick call in 2 minutes",
    outputs: { e2e: false, doc: true, linear: true, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-15",
  },
  {
    id: "j-010", title: "Punch Into Shift", module: "operations", actor: "employee",
    trigger: "Arrive at work → Home → Punch in", platform: "mobile", priority: "P0", status: "live",
    steps: ["Tap 'Stemple inn' button", "GPS verification (optional)", "App context switches to active session", "Feed loads: Day Brief pinned, tasks by urgency", "Points awarded for on-time arrival"],
    testAssertion: "punch in → GPS check → session context active → feed loads → punch record created",
    docTitle: "Starting your shift",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: "2026-02-28T14:30:00", lastTestResult: "pass", createdAt: "2026-01-15",
  },
  {
    id: "j-011", title: "Work Through Feed Tasks", module: "operations", actor: "employee",
    trigger: "On shift → Feed items appear", platform: "mobile", priority: "P0", status: "implementing",
    steps: ["See personalized feed (tasks, notes, messages by urgency)", "Tap task → Open procedure stepper", "Follow step-by-step → Check off each step", "Complete task (photo/data if required)", "Points earned → Next task surfaces"],
    testAssertion: "feed loads tasks → open task → complete steps → task done → points recorded",
    docTitle: "Your shift task list",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-01",
  },
  {
    id: "j-012", title: "Record Handoff", module: "operations", actor: "employee",
    trigger: "Shift ending → Handoff prompt", platform: "mobile", priority: "P1", status: "defined",
    steps: ["System prompts: 'Record handoff for next shift'", "Choose: text / voice / AI-assisted", "Enter notes about open issues, VIPs, prep status", "Submit → Handoff attached to session", "Next shift sees it in Day Brief"],
    testAssertion: "handoff prompt → record → submit → visible in next session Day Brief",
    docTitle: "Handing over to the next shift",
    outputs: { e2e: false, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-10",
  },
  {
    id: "j-013", title: "Punch Out & See Summary", module: "operations", actor: "employee",
    trigger: "End of shift", platform: "mobile", priority: "P0", status: "live",
    steps: ["Complete remaining tasks or mark as inherited", "Tap 'Stemple ut'", "See shift summary: hours, tasks completed, points earned", "Overtime flagged if applicable", "Session context clears"],
    testAssertion: "punch out → hours calculated → summary shown → overtime detected if applicable",
    docTitle: "Ending your shift",
    outputs: { e2e: true, doc: true, linear: true, botsson: false },
    lastTestRun: "2026-02-28T14:30:00", lastTestResult: "pass", createdAt: "2026-01-15",
  },
  {
    id: "j-014", title: "Morning Check / Day Brief", module: "operations", actor: "admin",
    trigger: "Open app in morning", platform: "both", priority: "P0", status: "implementing",
    steps: ["See dashboard: who's working, gaps, alerts", "Review AI-compiled Day Brief", "Check overnight handoff notes", "See HACCP status, open tasks from previous day", "Act on alerts (sick calls, deviations, deadlines)"],
    testAssertion: "login → dashboard loads → Day Brief present → alerts actionable",
    docTitle: "Your morning 5-minute check",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-01",
  },
  {
    id: "j-015", title: "Log Temperature Reading", module: "haccp", actor: "employee",
    trigger: "Feed task: Temperaturkontroll", platform: "mobile", priority: "P0", status: "testing",
    steps: ["Open HACCP task from feed", "See asset list with acceptable ranges", "Enter temperature for each asset", "Auto-validation: green (OK) / red (deviation)", "Submit → Audit trail created"],
    testAssertion: "open HACCP task → enter readings → in-range = green → out-of-range triggers deviation",
    docTitle: "Daily temperature logging",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: "2026-02-28T10:00:00", lastTestResult: "pass", createdAt: "2026-01-20",
  },
  {
    id: "j-016", title: "Handle Deviation", module: "haccp", actor: "employee",
    trigger: "Temperature out of range", platform: "mobile", priority: "P0", status: "defined",
    steps: ["Deviation auto-flagged → Runbook triggered", "Follow corrective action steps", "Document action taken (text + photo)", "Escalate to manager if required", "Manager reviews → Approves/requests further action"],
    testAssertion: "deviation detected → runbook loads → corrective action logged → resolution recorded",
    docTitle: "What to do when something's wrong",
    outputs: { e2e: false, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-05",
  },
  {
    id: "j-017", title: "Complete Training Module", module: "training", actor: "employee",
    trigger: "Assigned training or onboarding", platform: "both", priority: "P0", status: "implementing",
    steps: ["See assigned protocols with completion status", "Open protocol → Procedure steps with media", "Read/watch content → Progress through steps", "Take knowledge test", "Pass → Readiness score updated → Points earned"],
    testAssertion: "open training → complete steps → take test → pass → readiness increases",
    docTitle: "Completing your required training",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-01-25",
  },
  {
    id: "j-018", title: "Sign Confirmation / Contract", module: "training", actor: "employee",
    trigger: "New document requires signature", platform: "both", priority: "P0", status: "defined",
    steps: ["Notification: 'New document requires your signature'", "Open document → Read content", "Digital signature via DocuSeal", "Confirmation recorded → Readiness updated"],
    testAssertion: "confirmation assigned → opened → signed via DocuSeal → readiness updated",
    docTitle: "Signing documents digitally",
    outputs: { e2e: true, doc: true, linear: true, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-10",
  },
  {
    id: "j-019", title: "Receive & Act on Notification", module: "communication", actor: "employee",
    trigger: "Push notification arrives", platform: "mobile", priority: "P0", status: "live",
    steps: ["See notification: shift reminder / message / task / training", "Tap → Deep link to relevant screen", "Act on content", "Notification marked as read"],
    testAssertion: "trigger event → push sent → tap → correct screen opens → action possible",
    docTitle: "Understanding your notifications",
    outputs: { e2e: true, doc: true, linear: true, botsson: false },
    lastTestRun: "2026-02-28T14:30:00", lastTestResult: "pass", createdAt: "2026-01-15",
  },
  {
    id: "j-020", title: "Team Chat During Shift", module: "communication", actor: "employee",
    trigger: "Chat tab → Team channel", platform: "mobile", priority: "P1", status: "draft",
    steps: ["Open team/department channel", "Send message (text, photo)", "Real-time delivery via Supabase Realtime", "See read receipts"],
    testAssertion: "send message → received in real-time → read receipt shown",
    docTitle: "Chatting with your team",
    outputs: { e2e: false, doc: true, linear: false, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-20",
  },
  {
    id: "j-021", title: "View My Salary", module: "payroll", actor: "employee",
    trigger: "Me tab → Lønn", platform: "both", priority: "P1", status: "draft",
    steps: ["See current period hours worked", "Breakdown: regular, overtime, supplements", "See tip distribution if applicable", "View historical payslips"],
    testAssertion: "open salary → hours match punches → supplements calculated → history accessible",
    docTitle: "Understanding your pay",
    outputs: { e2e: false, doc: true, linear: false, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-25",
  },
  {
    id: "j-022", title: "Run Payroll Period", module: "payroll", actor: "admin",
    trigger: "Desktop → Payroll → Run period", platform: "desktop", priority: "P1", status: "draft",
    steps: ["Select pay period", "System auto-calculates from punch data", "Review: hours, overtime, supplements, deductions", "Flag anomalies (missed punches, excessive overtime)", "Approve → Export to payroll system"],
    testAssertion: "run payroll → calculations match Norwegian labor law → anomalies flagged → export valid",
    docTitle: "Processing payroll",
    outputs: { e2e: false, doc: false, linear: false, botsson: false },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-25",
  },
  {
    id: "j-023", title: "Set Up Season", module: "season", actor: "admin",
    trigger: "Desktop → Season Manager → Create", platform: "desktop", priority: "P1", status: "defined",
    steps: ["Name the season", "Configure: departments, locations, zones, teams", "Set season-specific policies & protocols", "Configure gamification: point rates, boosters", "Review battlefield → Click 'Aktiver'"],
    testAssertion: "create season → configure → activate → all season-aware entities reflect new season",
    docTitle: "Setting up your season",
    outputs: { e2e: false, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-02-15",
  },
  {
    id: "j-024", title: "Create Policy & Protocol", module: "governance", actor: "admin",
    trigger: "Desktop → Governance Studio", platform: "desktop", priority: "P0", status: "implementing",
    steps: ["Create Policy: name, description, scope", "Attach Protocol: choose enforcement type", "Build Procedure (steps with media)", "Add Knowledge Test", "Add Confirmation (DocuSeal)", "Assign to departments/teams", "Publish → Employees see in training queue"],
    testAssertion: "create policy → build protocol → add procedure + test → assign → visible in employee training",
    docTitle: "Creating rules your team can follow",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: null, lastTestResult: null, createdAt: "2026-01-20",
  },
  {
    id: "j-025", title: "Configure Organization", module: "org", actor: "admin",
    trigger: "First login → Setup wizard", platform: "desktop", priority: "P0", status: "live",
    steps: ["Stage 1: Departments", "Stage 2: Locations", "Stage 3: Zones", "Stage 4: Assets", "Stage 5: Positions", "Stage 6: Teams", "Stage 7: Settings"],
    testAssertion: "wizard starts → each stage creates entities → all visible in org structure",
    docTitle: "Setting up your restaurant's structure",
    outputs: { e2e: true, doc: true, linear: true, botsson: true },
    lastTestRun: "2026-02-28T14:30:00", lastTestResult: "pass", createdAt: "2026-01-10",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────
const getModule = (id) => MODULES.find((m) => m.id === id);
const getStatus = (id) => STATUSES.find((s) => s.id === id);
const getActor = (id) => ACTORS.find((a) => a.id === id);
const getPriority = (id) => PRIORITIES.find((p) => p.id === id);
const formatDate = (d) => d ? new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatTime = (d) => d ? new Date(d).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }) : "";

function Badge({ label, color, bg, small }) {
  return (
    <span style={{
      padding: small ? "2px 8px" : "3px 10px", borderRadius: 8,
      fontSize: small ? 10 : 11, fontWeight: 600,
      background: bg || `${color}15`, color,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function Btn({ children, onClick, variant = "default", size = "md", style: sx = {}, disabled }) {
  const base = { border: "none", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1 };
  const variants = {
    default: { background: "#f1f5f9", color: "#334155", padding: size === "sm" ? "6px 12px" : "10px 18px", fontSize: size === "sm" ? 12 : 13 },
    primary: { background: "#3b82f6", color: "white", padding: size === "sm" ? "6px 12px" : "10px 18px", fontSize: size === "sm" ? 12 : 13 },
    success: { background: "#10b981", color: "white", padding: size === "sm" ? "6px 12px" : "10px 18px", fontSize: size === "sm" ? 12 : 13 },
    danger: { background: "#ef4444", color: "white", padding: size === "sm" ? "6px 12px" : "10px 18px", fontSize: size === "sm" ? 12 : 13 },
    ghost: { background: "transparent", color: "#64748b", padding: size === "sm" ? "4px 8px" : "8px 14px", fontSize: size === "sm" ? 12 : 13 },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...sx }}>{children}</button>;
}

// ─── Generate Output Content ─────────────────────────────────────────
function generateE2E(j) {
  const mod = getModule(j.module);
  return `import { test, expect } from '@playwright/test';

/**
 * Journey: ${j.title}
 * Module:  ${mod.name}
 * Actor:   ${j.actor}
 * ID:      ${j.id}
 */
test.describe('${mod.name} → ${j.title}', () => {
  test('${j.testAssertion}', async ({ page }) => {
${j.steps.map((s, i) => `    // Step ${i + 1}: ${s}
    // TODO: Implement assertion`).join('\n\n')}
  });

  test('handles empty state gracefully', async ({ page }) => {
    // TODO: Test empty/error states
  });

  test('validates access control for ${j.actor} role', async ({ page }) => {
    // TODO: Verify role-based access
  });
});`;
}

function generateDoc(j) {
  const mod = getModule(j.module);
  return `# ${j.docTitle || j.title}

> ${mod.icon} ${mod.name} · ${j.platform === "mobile" ? "📱 Mobilapp" : j.platform === "desktop" ? "🖥️ Desktop" : "🖥️📱 Begge plattformer"}

## Hva gjør denne funksjonen?

${j.steps[0]}

## Slik gjør du det

${j.steps.map((s, i) => `### Steg ${i + 1}
${s}
`).join('\n')}
## Tips

- Trenger du hjelp? Spør Mr. Botsson — trykk på AI-knappen nederst.
- Denne guiden er tilgjengelig i appen under **Meg → Hjelp**.

---
*Generert fra journey ${j.id} · ${new Date().toLocaleDateString("nb-NO")}*`;
}

function generateLinear(j) {
  const mod = getModule(j.module);
  const pri = getPriority(j.priority);
  return `## ${j.title}

**Module:** ${mod.icon} ${mod.name}
**Priority:** ${pri.label}
**Actor:** ${j.actor}
**Platform:** ${j.platform}
**Journey ID:** ${j.id}

### User Story

As a **${j.actor}**, I want to **${j.title.toLowerCase()}** so that I can ${j.steps[j.steps.length - 1].toLowerCase()}.

### Trigger
${j.trigger}

### Acceptance Criteria

${j.steps.map((s, i) => `- [ ] Step ${i + 1}: ${s}`).join('\n')}

### E2E Test Assertion
\`${j.testAssertion}\`

### Technical Notes
- Platform: ${j.platform}
- Module: ${mod.name} (${j.module})
- Dependencies: [List dependencies]
- Database tables: [List affected tables]

### Definition of Done
- [ ] All steps implemented
- [ ] E2E test passing
- [ ] Onboarding doc generated
- [ ] Mr. Botsson script updated (if applicable)
- [ ] Code reviewed
- [ ] Deployed to staging`;
}

function generateBotsson(j) {
  const mod = getModule(j.module);
  return `# Mr. Botsson Voice Script
## Journey: ${j.title}

---

**[GREETING]**
"Hei! La meg vise deg hvordan du ${j.title.toLowerCase()}."

${j.steps.map((s, i) => `**[STEP ${i + 1}]**
*Action:* ${s}
*Mr. Botsson says:*
"${i === 0 ? "Først" : i === j.steps.length - 1 ? "Til slutt" : "Neste steg"}, ${s.toLowerCase().replace("→", "— da").replace("→", "og så")}."
${i < j.steps.length - 1 ? '*[Wait for user to complete action]*' : ''}
`).join('\n')}
**[COMPLETION]**
"Bra jobba! 🎉 Du har nå lært ${j.title.toLowerCase()}. ${j.docTitle ? `Du finner denne guiden under Meg → Hjelp → ${j.docTitle}.` : "Spør meg om du trenger hjelp senere!"}"

---
*Script ID: botsson-${j.id}*
*Module: ${mod.name}*
*Generated: ${new Date().toLocaleDateString("nb-NO")}*`;
}

// ─── Main Component ──────────────────────────────────────────────────
export default function JourneyPortal() {
  const [journeys, setJourneys] = useState(INITIAL_JOURNEYS);
  const [view, setView] = useState("table"); // table | detail | create
  const [selectedId, setSelectedId] = useState(null);
  const [detailTab, setDetailTab] = useState("steps");
  const [filterModule, setFilterModule] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterActor, setFilterActor] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [testRunning, setTestRunning] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New journey form state
  const [newJourney, setNewJourney] = useState({
    title: "", module: "core", actor: "employee", trigger: "", platform: "mobile",
    priority: "P1", steps: [""], testAssertion: "", docTitle: "",
  });

  const selected = journeys.find((j) => j.id === selectedId);
  const filtered = journeys.filter((j) => {
    if (filterModule !== "all" && j.module !== filterModule) return false;
    if (filterStatus !== "all" && j.status !== filterStatus) return false;
    if (filterActor !== "all" && j.actor !== filterActor) return false;
    if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s.id] = journeys.filter((j) => j.status === s.id).length;
    return acc;
  }, {});

  const handleStatusChange = useCallback((id, newStatus) => {
    setJourneys((prev) => prev.map((j) => j.id === id ? { ...j, status: newStatus } : j));
  }, []);

  const handleRunTest = useCallback((id) => {
    setTestRunning((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      const result = Math.random() > 0.2 ? "pass" : "fail";
      setJourneys((prev) => prev.map((j) =>
        j.id === id ? { ...j, lastTestRun: new Date().toISOString(), lastTestResult: result } : j
      ));
      setTestRunning((prev) => ({ ...prev, [id]: false }));
    }, 2000 + Math.random() * 2000);
  }, []);

  const handleRunAllTests = useCallback(() => {
    const liveJourneys = journeys.filter((j) => j.status === "live" || j.status === "testing");
    liveJourneys.forEach((j, i) => {
      setTimeout(() => handleRunTest(j.id), i * 800);
    });
  }, [journeys, handleRunTest]);

  const handleCreateJourney = useCallback(() => {
    const id = `j-${String(journeys.length + 1).padStart(3, "0")}`;
    const created = {
      ...newJourney, id, status: "draft",
      steps: newJourney.steps.filter((s) => s.trim()),
      outputs: { e2e: false, doc: false, linear: false, botsson: false },
      lastTestRun: null, lastTestResult: null,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setJourneys((prev) => [...prev, created]);
    setShowCreateModal(false);
    setNewJourney({ title: "", module: "core", actor: "employee", trigger: "", platform: "mobile", priority: "P1", steps: [""], testAssertion: "", docTitle: "" });
    setSelectedId(id);
    setView("detail");
  }, [newJourney, journeys]);

  const handleToggleOutput = useCallback((jId, outputType) => {
    setJourneys((prev) => prev.map((j) =>
      j.id === jId ? { ...j, outputs: { ...j.outputs, [outputType]: !j.outputs[outputType] } } : j
    ));
  }, []);

  // ─── Table View ──────────────────────────────────────────────────
  const TableView = () => (
    <div>
      {/* Status Pipeline */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button key={s.id} onClick={() => setFilterStatus(filterStatus === s.id ? "all" : s.id)}
            style={{
              padding: "10px 16px", borderRadius: 12, cursor: "pointer",
              border: filterStatus === s.id ? `2px solid ${s.color}` : "1px solid #e2e8f0",
              background: filterStatus === s.id ? s.bg : "white",
              display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
            }}>
            <span>{s.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
            <span style={{
              background: s.color, color: "white", borderRadius: 10,
              padding: "1px 8px", fontSize: 12, fontWeight: 700, minWidth: 22, textAlign: "center",
            }}>{statusCounts[s.id]}</span>
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk journeys..."
            style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.4 }}>🔍</span>
        </div>
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
          <option value="all">Alle moduler</option>
          {MODULES.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
        </select>
        <select value={filterActor} onChange={(e) => setFilterActor(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
          <option value="all">Alle aktører</option>
          {ACTORS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <Btn variant="success" onClick={handleRunAllTests}>🧪 Kjør alle tester</Btn>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["ID", "Journey", "Module", "Actor", "Platform", "Priority", "Status", "Last Test", "Outputs", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => {
                const mod = getModule(j.module);
                const status = getStatus(j.status);
                const actor = getActor(j.actor);
                const pri = getPriority(j.priority);
                const isRunning = testRunning[j.id];
                return (
                  <tr key={j.id}
                    onClick={() => { setSelectedId(j.id); setView("detail"); setDetailTab("steps"); }}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{j.id}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, maxWidth: 250 }}>{j.title}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span>{mod.icon}</span>
                        <span style={{ color: mod.color, fontWeight: 500 }}>{mod.name}</span>
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}><Badge label={actor.label} color={actor.color} small /></td>
                    <td style={{ padding: "12px 14px", fontSize: 16 }}>{j.platform === "both" ? "🖥️📱" : j.platform === "mobile" ? "📱" : "🖥️"}</td>
                    <td style={{ padding: "12px 14px" }}><Badge label={j.priority} color={pri.color} small /></td>
                    <td style={{ padding: "12px 14px" }}><Badge label={`${status.icon} ${status.label}`} color={status.color} bg={status.bg} /></td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {isRunning ? (
                        <span style={{ color: "#f59e0b", fontSize: 12 }}>⏳ Running...</span>
                      ) : j.lastTestResult === "pass" ? (
                        <span style={{ color: "#10b981", fontSize: 12 }}>✅ {formatDate(j.lastTestRun)}</span>
                      ) : j.lastTestResult === "fail" ? (
                        <span style={{ color: "#ef4444", fontSize: 12 }}>❌ {formatDate(j.lastTestRun)}</span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {OUTPUT_TYPES.map((o) => (
                          <span key={o.id} style={{ fontSize: 14, opacity: j.outputs[o.id] ? 1 : 0.15 }} title={o.label}>{o.icon}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn size="sm" onClick={() => handleRunTest(j.id)} disabled={isRunning}>🧪</Btn>
                        <select value={j.status} onChange={(e) => handleStatusChange(j.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 11, background: "white", cursor: "pointer" }}>
                          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Ingen journeys matcher filteret.</div>
        )}
      </div>
    </div>
  );

  // ─── Detail View ──────────────────────────────────────────────────
  const DetailView = () => {
    if (!selected) return null;
    const mod = getModule(selected.module);
    const status = getStatus(selected.status);
    const actor = getActor(selected.actor);
    const pri = getPriority(selected.priority);

    const tabs = [
      { id: "steps", label: "🗺️ Journey" },
      { id: "e2e", label: "🧪 E2E Test" },
      { id: "doc", label: "📖 Onboarding Doc" },
      { id: "linear", label: "🔲 Linear Issue" },
      { id: "botsson", label: "🤖 Mr. Botsson" },
    ];

    const outputContent = {
      e2e: generateE2E(selected),
      doc: generateDoc(selected),
      linear: generateLinear(selected),
      botsson: generateBotsson(selected),
    };

    return (
      <div>
        <Btn variant="ghost" onClick={() => setView("table")} style={{ marginBottom: 16 }}>← Tilbake til oversikt</Btn>

        {/* Header Card */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 28 }}>{mod.icon}</span>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{selected.title}</h2>
              </div>
              <div style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>{selected.trigger}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge label={`${mod.icon} ${mod.name}`} color={mod.color} />
                <Badge label={actor.label} color={actor.color} />
                <Badge label={selected.priority} color={pri.color} />
                <Badge label={selected.platform === "both" ? "🖥️📱 Both" : selected.platform === "mobile" ? "📱 Mobile" : "🖥️ Desktop"} color="#64748b" />
                <Badge label={`${status.icon} ${status.label}`} color={status.color} bg={status.bg} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={selected.status} onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
              <Btn variant="primary" onClick={() => handleRunTest(selected.id)} disabled={testRunning[selected.id]}>
                {testRunning[selected.id] ? "⏳ Running..." : "🧪 Kjør test"}
              </Btn>
            </div>
          </div>

          {/* Test Result Banner */}
          {selected.lastTestResult && (
            <div style={{
              marginTop: 16, padding: "10px 16px", borderRadius: 10,
              background: selected.lastTestResult === "pass" ? "#ecfdf5" : "#fef2f2",
              color: selected.lastTestResult === "pass" ? "#065f46" : "#991b1b",
              fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>{selected.lastTestResult === "pass" ? "✅ Siste test bestått" : "❌ Siste test feilet"}</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{formatDate(selected.lastTestRun)} {formatTime(selected.lastTestRun)}</span>
            </div>
          )}

          {/* Output Toggles */}
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, alignSelf: "center" }}>Genererte outputs:</span>
            {OUTPUT_TYPES.map((o) => (
              <button key={o.id} onClick={() => handleToggleOutput(selected.id, o.id)}
                style={{
                  padding: "6px 14px", borderRadius: 10, cursor: "pointer",
                  border: selected.outputs[o.id] ? `2px solid #10b981` : "1px solid #e2e8f0",
                  background: selected.outputs[o.id] ? "#ecfdf5" : "#f8fafc",
                  fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
                  color: selected.outputs[o.id] ? "#065f46" : "#94a3b8",
                }}>
                <span>{o.icon}</span> {o.label}
                {selected.outputs[o.id] && <span style={{ marginLeft: 2 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Content Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setDetailTab(t.id)}
              style={{
                padding: "10px 18px", borderRadius: 10, cursor: "pointer",
                border: detailTab === t.id ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                background: detailTab === t.id ? "#eff6ff" : "white",
                fontSize: 13, fontWeight: detailTab === t.id ? 600 : 400,
                transition: "all 0.15s",
              }}>{t.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {detailTab === "steps" && (
            <div style={{ padding: 24 }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600 }}>Journey Steps</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {selected.steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", background: mod.color,
                        color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700,
                      }}>{i + 1}</div>
                      {i < selected.steps.length - 1 && <div style={{ width: 2, height: 32, background: "#e2e8f0" }} />}
                    </div>
                    <div style={{ fontSize: 15, color: "#1e293b", paddingTop: 7, paddingBottom: 16, lineHeight: 1.5 }}>
                      {step}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
                <div style={{ background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 12, fontFamily: "monospace", fontSize: 12 }}>
                  <div style={{ color: "#94a3b8", marginBottom: 6, fontFamily: "system-ui", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>🧪 Test Assertion</div>
                  {selected.testAssertion}
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 16, borderRadius: 12, fontSize: 12, color: "#166534" }}>
                  <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>📖 Doc Page</div>
                  {selected.docTitle || "Ingen doc-tittel definert ennå"}
                </div>
              </div>
            </div>
          )}

          {detailTab !== "steps" && (
            <div style={{ padding: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {OUTPUT_TYPES.find((o) => o.id === detailTab)?.icon} {OUTPUT_TYPES.find((o) => o.id === detailTab)?.label}
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400, marginLeft: 8 }}>
                    {OUTPUT_TYPES.find((o) => o.id === detailTab)?.desc}
                  </span>
                </div>
                <Btn size="sm" onClick={() => navigator.clipboard.writeText(outputContent[detailTab])}>📋 Kopier</Btn>
              </div>
              <pre style={{
                margin: 0, padding: 24, fontSize: 12.5, lineHeight: 1.7, overflowX: "auto",
                background: detailTab === "e2e" ? "#0f172a" : "#fafafa",
                color: detailTab === "e2e" ? "#e2e8f0" : "#334155",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {outputContent[detailTab]}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Create Modal ─────────────────────────────────────────────────
  const CreateModal = () => (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={() => setShowCreateModal(false)}>
      <div style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 640,
        maxHeight: "90vh", overflow: "auto", padding: 32,
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700 }}>✨ Ny Journey</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Tittel *</label>
            <input value={newJourney.title} onChange={(e) => setNewJourney({ ...newJourney, title: e.target.value })}
              placeholder="f.eks. Check My Schedule"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Modul</label>
              <select value={newJourney.module} onChange={(e) => setNewJourney({ ...newJourney, module: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
                {MODULES.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Aktør</label>
              <select value={newJourney.actor} onChange={(e) => setNewJourney({ ...newJourney, actor: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
                {ACTORS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Prioritet</label>
              <select value={newJourney.priority} onChange={(e) => setNewJourney({ ...newJourney, priority: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Trigger</label>
              <input value={newJourney.trigger} onChange={(e) => setNewJourney({ ...newJourney, trigger: e.target.value })}
                placeholder="f.eks. Open app → Vakter tab"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Plattform</label>
              <select value={newJourney.platform} onChange={(e) => setNewJourney({ ...newJourney, platform: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}>
                {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Steps</label>
            {newJourney.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", background: "#e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#64748b", flexShrink: 0,
                }}>{i + 1}</span>
                <input value={step}
                  onChange={(e) => {
                    const updated = [...newJourney.steps];
                    updated[i] = e.target.value;
                    setNewJourney({ ...newJourney, steps: updated });
                  }}
                  placeholder={`Step ${i + 1}...`}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
                {newJourney.steps.length > 1 && (
                  <Btn variant="ghost" size="sm" onClick={() => {
                    const updated = newJourney.steps.filter((_, idx) => idx !== i);
                    setNewJourney({ ...newJourney, steps: updated });
                  }}>✕</Btn>
                )}
              </div>
            ))}
            <Btn size="sm" onClick={() => setNewJourney({ ...newJourney, steps: [...newJourney.steps, ""] })}>+ Legg til step</Btn>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>E2E Test Assertion</label>
            <input value={newJourney.testAssertion} onChange={(e) => setNewJourney({ ...newJourney, testAssertion: e.target.value })}
              placeholder="f.eks. login → dashboard loads → data visible"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Doc-tittel (for onboarding)</label>
            <input value={newJourney.docTitle} onChange={(e) => setNewJourney({ ...newJourney, docTitle: e.target.value })}
              placeholder="f.eks. Slik sjekker du vaktplanen din"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <Btn onClick={() => setShowCreateModal(false)}>Avbryt</Btn>
          <Btn variant="primary" onClick={handleCreateJourney} disabled={!newJourney.title.trim()}>Opprett Journey</Btn>
        </div>
      </div>
    </div>
  );

  // ─── Layout ───────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#1e293b" }}>
      {/* Top Nav */}
      <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Smartout</span>
            <span style={{ color: "#e2e8f0" }}>|</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>Journey Management</span>
            <span style={{ padding: "2px 8px", borderRadius: 6, background: "#eff6ff", color: "#3b82f6", fontSize: 11, fontWeight: 600 }}>/admin/journeys</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{journeys.length} journeys</span>
            <Btn variant="primary" onClick={() => setShowCreateModal(true)}>✨ Ny Journey</Btn>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        {/* Quick Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
          {STATUSES.map((s) => {
            const count = statusCounts[s.id];
            const total = journeys.length;
            return (
              <div key={s.id} style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{count}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{s.label}</div>
                <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, marginTop: 8 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: s.color, width: `${(count / total) * 100}%`, transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>

        {view === "table" && <TableView />}
        {view === "detail" && <DetailView />}
      </div>

      {showCreateModal && <CreateModal />}
    </div>
  );
}

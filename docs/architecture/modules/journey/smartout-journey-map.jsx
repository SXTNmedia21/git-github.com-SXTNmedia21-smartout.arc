import { useState } from "react";

const MODULES = [
  {
    id: "core",
    name: "Core",
    icon: "🔑",
    color: "#6366f1",
    desc: "Authentication, workspace, profile",
    journeys: [
      {
        id: "core-1",
        title: "Sign Up & Create Workspace",
        actor: "owner",
        trigger: "Landing page → Sign up",
        steps: [
          "Enter email/password → Create account",
          "AI scrapes website + Brønnøysund → Prepopulate workspace",
          "Confirm/adjust company details",
          "Mr. Botsson guides 7-stage setup wizard",
          "Workspace ready → Invite first employees",
        ],
        test: "E2E: signup → workspace exists → setup wizard completes → can invite",
        doc: "Onboarding guide: 'Your first 10 minutes with Smartout'",
        priority: "P0",
        platform: "desktop",
      },
      {
        id: "core-2",
        title: "Employee Accepts Invite",
        actor: "employee",
        trigger: "Email/SMS invite link",
        steps: [
          "Click invite → Create account (or link existing)",
          "Land in Trainee Mode (sandbox)",
          "AI greets → Profile setup (photo, language, emergency)",
          "Navigation tour → Core concepts intro",
          "Module journeys begin based on first shift needs",
        ],
        test: "E2E: invite sent → account created → trainee mode active → AI greeting shown",
        doc: "Employee guide: 'Welcome to your new workplace'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "core-3",
        title: "Login & Route to Context",
        actor: "all",
        trigger: "Open app / navigate to site",
        steps: [
          "Auth check → Route by role + state",
          "Employee on shift → Feed (Home tab)",
          "Employee off shift → Schedule view",
          "Admin → Dashboard overview",
          "Trainee → Onboarding progress",
        ],
        test: "E2E: login as each role → correct screen rendered → context matches state",
        doc: "n/a (invisible to user, but defines all routing logic)",
        priority: "P0",
        platform: "both",
      },
    ],
  },
  {
    id: "scheduling",
    name: "Scheduling (Vaktplan)",
    icon: "📅",
    color: "#0ea5e9",
    desc: "Shifts, availability, swaps, open shifts",
    journeys: [
      {
        id: "sched-1",
        title: "Check My Schedule",
        actor: "employee",
        trigger: "Open app → Vakter tab",
        steps: [
          "See week/month calendar with my shifts highlighted",
          "Tap shift → See detail (time, location, role, team, procedures)",
          "See who else is working that shift",
          "Empty state: 'Ingen vakter denne uken'",
        ],
        test: "E2E: open schedule → shifts visible → tap → detail correct → colleagues listed",
        doc: "Employee guide: 'Checking when you work next'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "sched-2",
        title: "Register Availability / Request Time Off",
        actor: "employee",
        trigger: "Vakter tab → 'Min tilgjengelighet'",
        steps: [
          "Open availability calendar",
          "Mark dates/times as unavailable",
          "Or: Request time off → Select dates → Add reason",
          "Submit → Manager notified",
          "See status: pending / approved / rejected",
        ],
        test: "E2E: mark unavailable → saved → visible in admin schedule grid → conflict detected if shift exists",
        doc: "Employee guide: 'Tell your manager when you can't work'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "sched-3",
        title: "Claim Open Shift",
        actor: "employee",
        trigger: "Push notification or Vakter tab → 'Ledige vakter'",
        steps: [
          "See list of unassigned shifts",
          "Filter by date, department, skill match",
          "Tap 'Ta vakten' → Express interest",
          "Manager approves/rejects",
          "Shift appears in my schedule",
        ],
        test: "E2E: open shift posted → employee claims → manager approves → shift assigned",
        doc: "Employee guide: 'Pick up extra shifts'",
        priority: "P1",
        platform: "mobile",
      },
      {
        id: "sched-4",
        title: "Request Shift Swap",
        actor: "employee",
        trigger: "Shift detail → 'Foreslå bytte'",
        steps: [
          "Select shift to swap",
          "See eligible colleagues (skill + availability match)",
          "Select colleague → Send swap request",
          "Colleague accepts/declines",
          "Manager approves → Shifts swapped",
        ],
        test: "E2E: request swap → colleague notified → accepts → manager approves → both schedules updated",
        doc: "Employee guide: 'Swap a shift with a colleague'",
        priority: "P1",
        platform: "mobile",
      },
      {
        id: "sched-5",
        title: "Build Weekly Schedule",
        actor: "admin",
        trigger: "Desktop → Schedule Builder",
        steps: [
          "Open drag-and-drop grid (employee/position/team × days)",
          "Create shifts from templates or custom",
          "Assign employees (see availability + skill match + cost overlay)",
          "Handle conflicts (overtime, rest time, skill gaps)",
          "Review cost per day → Publish schedule",
          "All employees notified of their shifts",
        ],
        test: "E2E: create shifts → assign → validate no conflicts → publish → employees see shifts",
        doc: "Admin guide: 'Planning next week's schedule'",
        priority: "P0",
        platform: "desktop",
      },
      {
        id: "sched-6",
        title: "Handle Sick Call",
        actor: "admin",
        trigger: "Notification: 'Ole meldte seg syk'",
        steps: [
          "See affected shift details",
          "System suggests replacement (available + qualified)",
          "One-tap: Send request to suggested employee",
          "Employee confirms → Shift reassigned",
          "Or: Post as open shift",
        ],
        test: "E2E: sick call → replacement suggested → sent → confirmed → schedule updated",
        doc: "Admin guide: 'Covering a sick call in 2 minutes'",
        priority: "P0",
        platform: "both",
      },
    ],
  },
  {
    id: "operations",
    name: "Operations (Drift)",
    icon: "⚡",
    color: "#f59e0b",
    desc: "Punch clock, feed, tasks, sessions, handoffs",
    journeys: [
      {
        id: "ops-1",
        title: "Punch Into Shift",
        actor: "employee",
        trigger: "Arrive at work → Home tab → Punch in",
        steps: [
          "Tap 'Stemple inn' button",
          "GPS verification (optional)",
          "App context switches to active session",
          "Feed loads: Day Brief pinned, tasks by urgency",
          "Points awarded for on-time arrival",
        ],
        test: "E2E: punch in → GPS check → session context active → feed loads → punch record created",
        doc: "Employee guide: 'Starting your shift'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "ops-2",
        title: "Work Through Feed Tasks",
        actor: "employee",
        trigger: "On shift → Feed items appear",
        steps: [
          "See personalized feed (tasks, notes, messages by urgency)",
          "Tap task → Open procedure stepper",
          "Follow step-by-step → Check off each step",
          "Complete task (photo/data if required)",
          "Points earned → Next task surfaces",
        ],
        test: "E2E: feed loads tasks → open task → complete steps → task marked done → points recorded",
        doc: "Employee guide: 'Your shift task list'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "ops-3",
        title: "Record Handoff",
        actor: "employee",
        trigger: "Shift ending → Handoff prompt",
        steps: [
          "System prompts: 'Record handoff for next shift'",
          "Choose: text / voice / AI-assisted",
          "Enter notes about open issues, VIPs, prep status",
          "Submit → Handoff attached to session",
          "Next shift sees it in their Day Brief",
        ],
        test: "E2E: handoff prompt → record → submit → visible in next session's Day Brief",
        doc: "Employee guide: 'Handing over to the next shift'",
        priority: "P1",
        platform: "mobile",
      },
      {
        id: "ops-4",
        title: "Punch Out & See Summary",
        actor: "employee",
        trigger: "End of shift → Punch out",
        steps: [
          "Complete remaining tasks or mark as inherited",
          "Tap 'Stemple ut'",
          "See shift summary: hours, tasks completed, points earned",
          "Overtime flagged if applicable",
          "Session context clears",
        ],
        test: "E2E: punch out → hours calculated → summary shown → overtime detected if applicable",
        doc: "Employee guide: 'Ending your shift'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "ops-5",
        title: "Morning Check / Day Brief Review",
        actor: "admin",
        trigger: "Open app in morning",
        steps: [
          "See dashboard: who's working, any gaps, alerts",
          "Review Day Brief: AI-compiled morning summary",
          "Check overnight handoff notes",
          "See HACCP status, open tasks from previous day",
          "Act on alerts (sick calls, deviations, deadlines)",
        ],
        test: "E2E: login → dashboard loads → Day Brief present → alerts actionable → HACCP status visible",
        doc: "Admin guide: 'Your morning 5-minute check'",
        priority: "P0",
        platform: "both",
      },
      {
        id: "ops-6",
        title: "Sign Off Department Session",
        actor: "admin",
        trigger: "End of day → Session Board",
        steps: [
          "Open Session Board (department overview)",
          "Review all task completion rates",
          "Check HACCP compliance for the day",
          "Review handoff quality",
          "Sign off session → Day closed",
        ],
        test: "E2E: open session board → all tasks visible → sign off → session status = closed",
        doc: "Admin guide: 'Closing out the day'",
        priority: "P1",
        platform: "desktop",
      },
    ],
  },
  {
    id: "haccp",
    name: "HACCP & Food Safety",
    icon: "🌡️",
    color: "#ef4444",
    desc: "Temperature, hygiene, deviations, audit trail",
    journeys: [
      {
        id: "haccp-1",
        title: "Log Temperature Reading",
        actor: "employee",
        trigger: "Feed task: 'Temperaturkontroll kjøleskap'",
        steps: [
          "Open HACCP task from feed",
          "See asset list with acceptable ranges displayed",
          "Enter temperature for each asset",
          "Auto-validation: green (OK) / red (deviation)",
          "Submit → Audit trail created",
        ],
        test: "E2E: open HACCP task → enter readings → in-range = green → out-of-range triggers deviation → audit record saved",
        doc: "Employee guide: 'Daily temperature logging'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "haccp-2",
        title: "Handle Deviation",
        actor: "employee",
        trigger: "Temperature out of range / hygiene fail",
        steps: [
          "Deviation auto-flagged → Runbook triggered",
          "Follow corrective action steps",
          "Document action taken (text + photo)",
          "Escalate to manager if required",
          "Manager reviews → Approves/requests further action",
        ],
        test: "E2E: deviation detected → runbook loads → corrective action logged → manager notified → resolution recorded",
        doc: "Employee guide: 'What to do when something's wrong'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "haccp-3",
        title: "Export Compliance Report",
        actor: "admin",
        trigger: "Mattilsynet inspection or monthly review",
        steps: [
          "Desktop → Reports → HACCP",
          "Select date range",
          "See all readings, deviations, corrective actions",
          "Full audit trail with timestamps and actors",
          "Export PDF for inspector",
        ],
        test: "E2E: open HACCP report → filter dates → all records present → export generates valid PDF",
        doc: "Admin guide: 'Preparing for Mattilsynet'",
        priority: "P1",
        platform: "desktop",
      },
    ],
  },
  {
    id: "training",
    name: "Training & Competence",
    icon: "🎓",
    color: "#8b5cf6",
    desc: "Protocols, knowledge tests, readiness score",
    journeys: [
      {
        id: "train-1",
        title: "Complete Training Module",
        actor: "employee",
        trigger: "Assigned training / Onboarding / Me tab",
        steps: [
          "See assigned protocols with completion status",
          "Open protocol → Procedure steps with media",
          "Read/watch content → Progress through steps",
          "Take knowledge test at the end",
          "Pass → Readiness score updated → Points earned",
        ],
        test: "E2E: open training → complete steps → take test → pass → readiness score increases → certificate generated",
        doc: "Employee guide: 'Completing your required training'",
        priority: "P0",
        platform: "both",
      },
      {
        id: "train-2",
        title: "Sign Confirmation / Contract",
        actor: "employee",
        trigger: "Assigned confirmation or new contract",
        steps: [
          "Notification: 'New document requires your signature'",
          "Open document → Read content",
          "Digital signature via DocuSeal",
          "Confirmation recorded → Readiness updated",
        ],
        test: "E2E: confirmation assigned → opened → signed via DocuSeal → status = signed → readiness updated",
        doc: "Employee guide: 'Signing documents digitally'",
        priority: "P0",
        platform: "both",
      },
      {
        id: "train-3",
        title: "Check Readiness Dashboard",
        actor: "admin",
        trigger: "Desktop → People → Select employee",
        steps: [
          "See employee readiness score (0-100%)",
          "Breakdown: which policies learned, protocols completed",
          "See overdue/upcoming training deadlines",
          "Identify gaps → Assign additional training",
          "Monitor trainee progress before first shift",
        ],
        test: "E2E: open employee profile → readiness score calculated → breakdown matches completions → can assign new training",
        doc: "Admin guide: 'Making sure your team is ready'",
        priority: "P0",
        platform: "desktop",
      },
    ],
  },
  {
    id: "communication",
    name: "Communication",
    icon: "💬",
    color: "#10b981",
    desc: "Chat, notifications, announcements",
    journeys: [
      {
        id: "comm-1",
        title: "Receive & Act on Push Notification",
        actor: "employee",
        trigger: "Push notification arrives",
        steps: [
          "See notification: shift reminder / new message / task alert / training due",
          "Tap → Deep link to relevant screen",
          "Act on content (read message, view shift, start task)",
          "Notification marked as read",
        ],
        test: "E2E: trigger event → push sent → tap → correct screen opens → action possible",
        doc: "Employee guide: 'Understanding your notifications'",
        priority: "P0",
        platform: "mobile",
      },
      {
        id: "comm-2",
        title: "Team Chat During Shift",
        actor: "employee",
        trigger: "Chat tab → Team channel",
        steps: [
          "Open team/department channel",
          "Send message (text, photo)",
          "Real-time delivery via Supabase Realtime",
          "See read receipts",
          "Pin important messages",
        ],
        test: "E2E: send message → received in real-time by team → read receipt shown",
        doc: "Employee guide: 'Chatting with your team'",
        priority: "P1",
        platform: "mobile",
      },
      {
        id: "comm-3",
        title: "Send Workspace Announcement",
        actor: "admin",
        trigger: "Desktop → Communication → New announcement",
        steps: [
          "Write announcement content",
          "Target: all / department / team / location",
          "Choose channels: in-app + push + optional email/SMS",
          "Schedule or send immediately",
          "Track read receipts",
        ],
        test: "E2E: create announcement → target group → send → received by all targets → read tracking works",
        doc: "Admin guide: 'Communicating with your team'",
        priority: "P1",
        platform: "desktop",
      },
    ],
  },
  {
    id: "payroll",
    name: "Payroll & Finance",
    icon: "💰",
    color: "#f97316",
    desc: "Salary, overtime, supplements, tips",
    journeys: [
      {
        id: "pay-1",
        title: "View My Salary / Hours",
        actor: "employee",
        trigger: "Me tab → Lønn (Salary)",
        steps: [
          "See current period hours worked",
          "Breakdown: regular, overtime, night/weekend supplements",
          "See tip distribution if applicable",
          "View historical payslips",
        ],
        test: "E2E: open salary → hours match punch records → supplements correctly calculated → history accessible",
        doc: "Employee guide: 'Understanding your pay'",
        priority: "P1",
        platform: "both",
      },
      {
        id: "pay-2",
        title: "Run Payroll Period",
        actor: "admin",
        trigger: "Desktop → Payroll → Run period",
        steps: [
          "Select pay period",
          "System auto-calculates from punch data",
          "Review: hours, overtime (40%/50% rules), supplements, deductions",
          "Flag anomalies (missed punches, excessive overtime)",
          "Approve → Export to payroll system",
        ],
        test: "E2E: run payroll → calculations match Norwegian labor law → anomalies flagged → export generates valid file",
        doc: "Admin guide: 'Processing payroll'",
        priority: "P1",
        platform: "desktop",
      },
    ],
  },
  {
    id: "season",
    name: "Season & Gamification",
    icon: "🏆",
    color: "#eab308",
    desc: "Setup battlefield, activate, compete",
    journeys: [
      {
        id: "season-1",
        title: "Set Up Season (Battlefield)",
        actor: "admin",
        trigger: "Desktop → Season Manager → Create",
        steps: [
          "Name the season (e.g., 'Sommer 2026')",
          "Configure: active departments, locations, zones, teams",
          "Set season-specific policies & protocols",
          "Configure gamification: point rates, boosters, penalties",
          "Set leaderboard scope: team vs department vs workspace",
          "Review battlefield → Click 'Aktiver'",
        ],
        test: "E2E: create season → configure all elements → activate → all season-aware entities reflect new season",
        doc: "Admin guide: 'Setting up your season'",
        priority: "P1",
        platform: "desktop",
      },
      {
        id: "season-2",
        title: "Check Leaderboard & Points",
        actor: "employee",
        trigger: "Me tab → Points / Leaderboard",
        steps: [
          "See personal point total for active season",
          "View breakdown: task points, training, HACCP, on-time",
          "See team leaderboard position",
          "See department/workspace rankings",
          "View achievements and badges",
        ],
        test: "E2E: open leaderboard → points match earned actions → rankings calculated → achievements displayed",
        doc: "Employee guide: 'Your points and achievements'",
        priority: "P2",
        platform: "both",
      },
    ],
  },
  {
    id: "governance",
    name: "Governance (Policy → Protocol)",
    icon: "📜",
    color: "#64748b",
    desc: "Business rules → enforcement mechanisms",
    journeys: [
      {
        id: "gov-1",
        title: "Create Policy & Protocol",
        actor: "admin",
        trigger: "Desktop → Governance Studio",
        steps: [
          "Create Policy: name, description, scope, category",
          "Attach Protocol: choose enforcement type",
          "Build Procedure (step-by-step instructions with media)",
          "Add Knowledge Test (quiz questions)",
          "Add Confirmation (signature requirement via DocuSeal)",
          "Assign to departments/teams/positions",
          "Publish → Employees see in their training queue",
        ],
        test: "E2E: create policy → build protocol → add procedure + test → assign → visible in employee training",
        doc: "Admin guide: 'Creating rules your team can follow'",
        priority: "P0",
        platform: "desktop",
      },
    ],
  },
  {
    id: "org",
    name: "Org Structure",
    icon: "🏢",
    color: "#06b6d4",
    desc: "Departments, locations, zones, teams, positions",
    journeys: [
      {
        id: "org-1",
        title: "Configure Organization (Setup Wizard)",
        actor: "admin",
        trigger: "First login → Mr. Botsson setup wizard",
        steps: [
          "Stage 1: Departments (Kitchen, Service, Bar...)",
          "Stage 2: Locations (addresses, physical spaces)",
          "Stage 3: Zones (sections within locations)",
          "Stage 4: Assets (equipment needing routines/training)",
          "Stage 5: Positions (Kokk, Servitør, Bartender...)",
          "Stage 6: Teams (dynamic groups)",
          "Stage 7: Settings & preferences",
        ],
        test: "E2E: wizard starts → each stage creates entities → all visible in org structure → ready for scheduling",
        doc: "Admin guide: 'Setting up your restaurant's structure'",
        priority: "P0",
        platform: "desktop",
      },
    ],
  },
];

const ACTORS = {
  employee: { label: "Ansatt", color: "#3b82f6", bg: "#eff6ff" },
  admin: { label: "Admin/Leder", color: "#f59e0b", bg: "#fffbeb" },
  owner: { label: "Eier", color: "#8b5cf6", bg: "#f5f3ff" },
  all: { label: "Alle", color: "#6b7280", bg: "#f9fafb" },
};

const PRIORITIES = {
  P0: { label: "P0 — Must have", color: "#ef4444", bg: "#fef2f2" },
  P1: { label: "P1 — Should have", color: "#f59e0b", bg: "#fffbeb" },
  P2: { label: "P2 — Nice to have", color: "#6b7280", bg: "#f9fafb" },
};

export default function JourneyMap() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [viewMode, setViewMode] = useState("journey");
  const [filterActor, setFilterActor] = useState("all-actors");
  const [filterPriority, setFilterPriority] = useState("all-priorities");

  const allJourneys = MODULES.flatMap((m) =>
    m.journeys.map((j) => ({ ...j, module: m }))
  );

  const filteredJourneys = allJourneys.filter((j) => {
    if (filterActor !== "all-actors" && j.actor !== filterActor) return false;
    if (filterPriority !== "all-priorities" && j.priority !== filterPriority) return false;
    if (selectedModule && j.module.id !== selectedModule) return false;
    return true;
  });

  const stats = {
    total: allJourneys.length,
    p0: allJourneys.filter((j) => j.priority === "P0").length,
    employee: allJourneys.filter((j) => j.actor === "employee").length,
    admin: allJourneys.filter((j) => j.actor === "admin" || j.actor === "owner").length,
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#1e293b" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: "32px 24px 24px", color: "white" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: "#94a3b8", marginBottom: 8 }}>
            Smartout User Journeys
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700 }}>
            Journey = Test = Docs
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 15, maxWidth: 700 }}>
            Every journey is defined once and serves three purposes: the user story (what/why), the E2E test (verification), and the onboarding doc (teaching). Same data, three perspectives.
          </p>
          {/* Stats */}
          <div style={{ display: "flex", gap: 24, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "Total Journeys", value: stats.total, color: "#60a5fa" },
              { label: "P0 Critical", value: stats.p0, color: "#f87171" },
              { label: "Employee", value: stats.employee, color: "#34d399" },
              { label: "Admin/Owner", value: stats.admin, color: "#fbbf24" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Three Perspectives Banner */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { mode: "journey", icon: "🗺️", label: "User Journey", desc: "What & Why — the narrative" },
            { mode: "test", icon: "🧪", label: "E2E Test", desc: "Verification — automated proof" },
            { mode: "doc", icon: "📖", label: "Onboarding Doc", desc: "Teaching — human explanation" },
          ].map((v) => (
            <button
              key={v.mode}
              onClick={() => setViewMode(v.mode)}
              style={{
                padding: "16px",
                borderRadius: 12,
                border: viewMode === v.mode ? "2px solid #3b82f6" : "2px solid #e2e8f0",
                background: viewMode === v.mode ? "#eff6ff" : "white",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{v.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{v.label}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{v.desc}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Filter:</span>
          <select
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}
          >
            <option value="all-actors">All actors</option>
            <option value="employee">Employee</option>
            <option value="admin">Admin/Manager</option>
            <option value="owner">Owner</option>
            <option value="all">All roles</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "white" }}
          >
            <option value="all-priorities">All priorities</option>
            <option value="P0">P0 — Must have</option>
            <option value="P1">P1 — Should have</option>
            <option value="P2">P2 — Nice to have</option>
          </select>
          {selectedModule && (
            <button
              onClick={() => { setSelectedModule(null); setSelectedJourney(null); }}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fef2f2", color: "#ef4444", cursor: "pointer" }}
            >
              ✕ Clear module filter
            </button>
          )}
        </div>

        {/* Module Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {MODULES.map((m) => {
            const isActive = selectedModule === m.id;
            const count = filteredJourneys.filter((j) => j.module.id === m.id).length;
            return (
              <button
                key={m.id}
                onClick={() => { setSelectedModule(isActive ? null : m.id); setSelectedJourney(null); }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: isActive ? `2px solid ${m.color}` : "1px solid #e2e8f0",
                  background: isActive ? `${m.color}10` : "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                  opacity: count === 0 ? 0.4 : 1,
                }}
              >
                <span>{m.icon}</span>
                <span>{m.name}</span>
                <span style={{ background: isActive ? m.color : "#e2e8f0", color: isActive ? "white" : "#64748b", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Journey Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredJourneys.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
              No journeys match the current filters.
            </div>
          )}
          {filteredJourneys.map((j) => {
            const isExpanded = selectedJourney === j.id;
            const actor = ACTORS[j.actor] || ACTORS.all;
            const priority = PRIORITIES[j.priority] || PRIORITIES.P1;
            return (
              <div
                key={j.id}
                style={{
                  background: "white",
                  borderRadius: 14,
                  border: isExpanded ? `2px solid ${j.module.color}` : "1px solid #e2e8f0",
                  overflow: "hidden",
                  transition: "all 0.15s",
                  boxShadow: isExpanded ? "0 4px 20px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <button
                  onClick={() => setSelectedJourney(isExpanded ? null : j.id)}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 20, width: 32, textAlign: "center" }}>{j.module.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{j.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{j.trigger}</div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: actor.bg, color: actor.color }}>
                    {actor.label}
                  </span>
                  <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: priority.bg, color: priority.color }}>
                    {j.priority}
                  </span>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, background: "#f1f5f9", color: "#64748b" }}>
                    {j.platform === "both" ? "🖥️📱" : j.platform === "mobile" ? "📱" : "🖥️"}
                  </span>
                  <span style={{ fontSize: 16, color: "#94a3b8", transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                    ▾
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "grid", gridTemplateColumns: viewMode === "journey" ? "1fr" : "1fr 1fr", gap: 16, paddingTop: 16 }}>
                      {/* Journey Steps - always visible */}
                      {(viewMode === "journey" || viewMode === "test") && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>
                            🗺️ Journey Steps
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {j.steps.map((step, i) => (
                              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                  <div style={{
                                    width: 26, height: 26, borderRadius: "50%", background: j.module.color,
                                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 12, fontWeight: 700,
                                  }}>
                                    {i + 1}
                                  </div>
                                  {i < j.steps.length - 1 && (
                                    <div style={{ width: 2, height: 20, background: "#e2e8f0" }} />
                                  )}
                                </div>
                                <div style={{ fontSize: 14, color: "#334155", paddingTop: 3, paddingBottom: i < j.steps.length - 1 ? 0 : 0 }}>
                                  {step}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Test Perspective */}
                      {viewMode === "test" && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>
                            🧪 E2E Test Assertion
                          </div>
                          <div style={{
                            background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 10,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.6,
                          }}>
                            <span style={{ color: "#94a3b8" }}>// {j.id}</span>
                            <br />
                            <span style={{ color: "#fb923c" }}>test</span>(<span style={{ color: "#a5f3fc" }}>'{j.title}'</span>, () =&gt; {"{"})
                            <br />
                            <span style={{ color: "#86efac", paddingLeft: 16, display: "inline-block" }}>{j.test}</span>
                            <br />
                            {"}"})
                          </div>
                        </div>
                      )}

                      {/* Doc Perspective */}
                      {viewMode === "doc" && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>
                                🗺️ Journey Steps
                              </div>
                              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.8 }}>
                                {j.steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 10 }}>
                                📖 Documentation Page
                              </div>
                              <div style={{
                                background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 16, borderRadius: 10, fontSize: 13, color: "#166534",
                              }}>
                                {j.doc}
                              </div>
                              <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
                                This becomes a page in the onboarding flow, a Mr. Botsson script, and a help article — all generated from the same journey definition.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Journey-only: show all three mini-views */}
                      {viewMode === "journey" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                          <div style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 10, fontFamily: "monospace", fontSize: 12 }}>
                            <div style={{ color: "#94a3b8", marginBottom: 4 }}>🧪 E2E Test:</div>
                            {j.test}
                          </div>
                          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 12, borderRadius: 10, fontSize: 12, color: "#166534" }}>
                            <div style={{ color: "#15803d", marginBottom: 4 }}>📖 Doc page:</div>
                            {j.doc}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Module → Journey Count Summary */}
        <div style={{ marginTop: 32, padding: 24, background: "white", borderRadius: 14, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Module → Journey Coverage</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {MODULES.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: m.color,
                      width: `${(m.journeys.length / 6) * 100}%`,
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.journeys.length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

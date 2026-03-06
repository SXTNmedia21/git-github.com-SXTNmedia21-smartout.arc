---
title: "Workspace Keys — Capability-Based Access & Compensation System"
status: draft
priority: high
updated: 2026-03-06
created: 2026-03-06
module: cross-cutting (M03 Governance, M05 HR, M07 Scheduling, M12 Operations)
tags: [access-control, capabilities, payroll, scheduling, policy, keys]
---

# Workspace Keys — Capability-Based Access & Compensation System

## Problem

`profile.role` (owner/admin/manager/employee) is too coarse for real restaurant operations. A servitör might sell alcohol but not close the register. A barista can make espresso but not open wine. Roles change per shift, per season, per person. The current system has no way to express:

- **What can this person DO?** (operations)
- **What shifts can they WORK?** (scheduling)
- **What extra should they be PAID?** (payroll)
- **What training must they COMPLETE first?** (governance)

These four concerns are separate modules today but share the same atomic unit: **a capability**.

## Core Concept: Workspace Keys

A **key** is an atomic capability that unlocks functionality. Keys are the bridge between the governance layer (policies → protocols → training) and the operational layer (scheduling, operations, payroll).

```
GOVERNANCE                    OPERATIONS
─────────────────────────────────────────────────
Policy                        Operations
  └─ Protocol                   "Can close bar register"
      └─ Training             Scheduling
          └─ Completion ─→ KEY   "Can work bar-closing shift"
                            ↓  Payroll
                               "+20kr/t ansvarstillägg"
```

**A key answers:** "This person is qualified and authorized to do X."

## Data Model

### New Tables

```sql
-- ══════════════════════════════════════════════════════════════
-- workspace_key: Capabilities available in a workspace
-- ══════════════════════════════════════════════════════════════
-- Keys are defined per workspace. Each workspace decides what
-- capabilities exist and how they connect to training, shifts,
-- and compensation.

workspace_key
├── key_id              uuid PK DEFAULT gen_random_uuid()
├── workspace_id        uuid FK → workspace NOT NULL
├── code                text NOT NULL          -- 'sell_alcohol', 'close_register'
├── name                text NOT NULL          -- "Alkoholservering"
├── description         text                   -- Why this key exists
├── category            workspace_key_category -- ENUM: see below
│
│   ── Training link ──
├── policy_id           uuid FK → policy       -- NULL = no training required
├── auto_grant          boolean DEFAULT false   -- Auto-grant when protocol completed?
│
│   ── Scheduling link ──
├── shift_tags          text[] DEFAULT '{}'     -- Shifts requiring this key: ['bar', 'closing']
│
│   ── Payroll link ──
├── pay_modifier_type   pay_modifier_type      -- ENUM: NULL, 'hourly', 'percentage', 'monthly'
├── pay_modifier_value  numeric(10,2)          -- 20.00 (kr/t), 5.00 (%), 500.00 (kr/mån)
├── pay_modifier_label  text                   -- "Alkoholansvar" (for payslip)
│
├── is_active           boolean DEFAULT true
├── sort_order          integer DEFAULT 0
├── created_at          timestamptz DEFAULT now()
├── updated_at          timestamptz DEFAULT now()
│
└── UNIQUE(workspace_id, code)


-- ══════════════════════════════════════════════════════════════
-- profile_key: Which profiles hold which keys
-- ══════════════════════════════════════════════════════════════

profile_key
├── profile_key_id      uuid PK DEFAULT gen_random_uuid()
├── profile_id          uuid FK → profile NOT NULL
├── key_id              uuid FK → workspace_key NOT NULL
├── status              profile_key_status     -- ENUM: 'active', 'training', 'expired', 'revoked'
├── source              key_grant_source       -- ENUM: 'manual', 'training_complete', 'role_default', 'bulk_assign'
├── granted_by          uuid FK → profile      -- Who granted (NULL for auto)
├── granted_at          timestamptz DEFAULT now()
├── expires_at          timestamptz            -- NULL = permanent
├── revoked_at          timestamptz            -- When revoked (if status = 'revoked')
├── revoked_reason      text                   -- Why revoked
├── created_at          timestamptz DEFAULT now()
├── updated_at          timestamptz DEFAULT now()
│
└── UNIQUE(profile_id, key_id)                 -- One key per profile


-- ══════════════════════════════════════════════════════════════
-- key_set: Named bundles of keys for quick assignment
-- ══════════════════════════════════════════════════════════════
-- "Bartender-paketet" = sell_alcohol + mix_drinks + close_bar
-- Assigning a set grants all its keys to the profile.

key_set
├── key_set_id          uuid PK DEFAULT gen_random_uuid()
├── workspace_id        uuid FK → workspace NOT NULL
├── name                text NOT NULL          -- "Bartender", "Hovmester", "Nyckelansvarig"
├── description         text
├── is_active           boolean DEFAULT true
├── created_at          timestamptz DEFAULT now()
├── updated_at          timestamptz DEFAULT now()
│
└── UNIQUE(workspace_id, name)

key_set_member                                 -- Junction table
├── key_set_id          uuid FK → key_set NOT NULL
├── key_id              uuid FK → workspace_key NOT NULL
│
└── PK(key_set_id, key_id)
```

### New Enums

```sql
CREATE TYPE workspace_key_category AS ENUM (
  'operations',   -- Close register, open/close location
  'safety',       -- HACCP, fire safety, first aid
  'access',       -- Key holder, alarm code, safe access
  'sales',        -- Alcohol, tobacco, age-restricted
  'specialist',   -- Sommelier, barista, sushi chef
  'admin'         -- Approve shifts, manage inventory
);

CREATE TYPE pay_modifier_type AS ENUM (
  'hourly',       -- +X kr per worked hour when key is active
  'percentage',   -- +X% on base hourly rate
  'monthly'       -- +X kr per month (flat)
);

CREATE TYPE profile_key_status AS ENUM (
  'active',       -- Key is live, profile can use it
  'training',     -- Protocol assigned but not completed
  'expired',      -- Past expires_at
  'revoked'       -- Manually revoked by admin
);

CREATE TYPE key_grant_source AS ENUM (
  'manual',             -- Admin granted directly
  'training_complete',  -- Auto-granted when protocol completed
  'role_default',       -- Granted by role (all admins get X)
  'bulk_assign'         -- Granted via key_set assignment
);
```

### RLS Policies

```sql
-- workspace_key: read for workspace members, write for admins
-- profile_key: read own + workspace admins, write for admins
-- key_set: same as workspace_key
-- Standard pattern: workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
```

## Integration Points

### 1. Governance (Policy → Protocol → Key)

**Existing flow:** Policy has Protocols → Protocols are assigned to Profiles → Profile completes training.

**New connection:** `workspace_key.policy_id` links a key to its training requirement. When `auto_grant = true` and all protocols under that policy are completed by a profile, a trigger inserts into `profile_key` with `source = 'training_complete'`.

```
policy (alkohollagen)
  └─ protocol (alkohol-e-kurs)
      └─ protocol_assignment (status: completed)
          └─ TRIGGER → INSERT profile_key (sell_alcohol, status: active, source: training_complete)
```

**No changes needed to policy/protocol tables.** The link is one-way: key → policy.

### 2. Scheduling (Key → Shift Requirements)

**Existing:** `schedule_shift` has `role` (text) and `zone` (text).

**New connection:** `workspace_key.shift_tags[]` defines which shift tags require this key. The scheduler checks: "Does this profile have all keys required for this shift's tags?"

```sql
-- Example check: Can profile X work a 'bar-closing' shift?
SELECT NOT EXISTS (
  SELECT 1 FROM workspace_key wk
  WHERE wk.workspace_id = $workspace_id
    AND 'bar-closing' = ANY(wk.shift_tags)
    AND wk.key_id NOT IN (
      SELECT pk.key_id FROM profile_key pk
      WHERE pk.profile_id = $profile_id AND pk.status = 'active'
    )
) AS is_qualified;
```

**No schema changes to schedule_shift.** The shift's existing `zone` or `role` field can map to tags. Enforcement is application-level.

### 3. Payroll (Key → Compensation Modifiers)

**Not yet built.** When payroll module is implemented, the calculation is:

```
effective_hourly_rate = base_rate
  + SUM(workspace_key.pay_modifier_value WHERE type = 'hourly' AND profile has active key)
  + base_rate * SUM(workspace_key.pay_modifier_value WHERE type = 'percentage') / 100
monthly_supplements = SUM(workspace_key.pay_modifier_value WHERE type = 'monthly')
```

**No payroll tables exist yet.** Keys are ready when payroll is built.

### 4. Operations (Key → Action Authorization)

**Future.** When department sessions and operational actions are built, each action can require specific keys. Example: "Close register" action checks for `close_register` key.

## Restaurant Example

### Keys for a mid-size restaurant

| Code               | Name              | Category   | Policy          | Shift Tags       | Pay Modifier |
| ------------------ | ----------------- | ---------- | --------------- | ---------------- | ------------ |
| `sell_alcohol`     | Alkoholservering  | sales      | Alkohollagen    | bar, restaurant  | +15 kr/t     |
| `close_register`   | Kassastängning    | operations | Kassarutiner    | closing          | +20 kr/t     |
| `key_holder`       | Nyckelansvarig    | access     | Nyckelansvar    | opening, closing | +500 kr/mån  |
| `food_safety_l2`   | HACCP Nivå 2      | safety     | HACCP Policy    | kitchen-lead     | +25 kr/t     |
| `barista`          | Kaffespecialist   | specialist | Kaffeutbildning | café             | —            |
| `sommelier`        | Vinansvarig       | specialist | Vinkurs         | fine-dining      | +30 kr/t     |
| `first_aid`        | Förstahjälpen     | safety     | Säkerhetspolicy | —                | —            |
| `open_location`    | Öppna lokal       | access     | Öppningsrutiner | opening          | +10 kr/t     |
| `approve_shifts`   | Godkänn vaktlista | admin      | — (manual only) | —                | —            |
| `manage_inventory` | Lagerhantering    | operations | Lagerrutiner    | —                | —            |

### Key Sets

| Set                | Keys                                                 |
| ------------------ | ---------------------------------------------------- |
| **Bartender**      | sell_alcohol, barista, close_register                |
| **Hovmester**      | sell_alcohol, sommelier, key_holder, approve_shifts  |
| **Nyckelansvarig** | key_holder, open_location, close_register, first_aid |
| **Kökschef**       | food_safety_l2, manage_inventory, first_aid          |

### User Journey: New Employee Gets Keys

1. **Day 1:** Admin assigns "Bartender" key set → Profile gets `sell_alcohol` (status: training), `barista` (training), `close_register` (training)
2. **Week 1:** Employee completes Kaffeutbildning protocol → `barista` auto-flips to `active`
3. **Week 2:** Employee completes Alkohollagen protocol → `sell_alcohol` flips to `active`
4. **Week 3:** Employee completes Kassarutiner protocol → `close_register` flips to `active`
5. **Now schedulable** for bar-closing shifts (has all required keys)
6. **Payroll:** Gets base rate + 15 kr/t (alcohol) + 20 kr/t (register) for bar-closing hours

## Implementation Phases

### Phase 1: Schema Only (THIS TASK)

- Migration: create tables, enums, RLS, indexes
- No UI, no enforcement, no triggers
- Just the data model ready for use

### Phase 2: Admin UI

- Workspace settings → Keys tab: CRUD workspace_key
- Key Sets: create bundles, assign to profiles
- Profile detail → Keys tab: view/grant/revoke

### Phase 3: Training Auto-Grant

- Trigger on `protocol_assignment` completion → check if all protocols under linked policy are done → auto-grant key
- Status lifecycle: training → active (on completion), active → expired (on expires_at)

### Phase 4: Scheduling Integration

- Shift planner: warn if assigned employee lacks required keys
- Employee availability: filter by qualified keys
- Shift templates: define required keys per template

### Phase 5: Payroll Integration

- Pay calculation engine reads active keys + modifiers
- Payslip line items from `pay_modifier_label`
- Reports: cost per key, cost per employee

## Migration Checklist

- [ ] Create enums: `workspace_key_category`, `pay_modifier_type`, `profile_key_status`, `key_grant_source`
- [ ] Create table: `workspace_key` with FK to workspace, policy
- [ ] Create table: `profile_key` with FK to profile, workspace_key
- [ ] Create table: `key_set` with FK to workspace
- [ ] Create table: `key_set_member` junction
- [ ] RLS: workspace-scoped read/write policies on all 4 tables
- [ ] Indexes: `workspace_key(workspace_id)`, `profile_key(profile_id)`, `profile_key(key_id, status)`
- [ ] Updated_at triggers on all new tables

## Decisions

| Decision                               | Choice                         | Reason                                                                                 |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Separate table vs extend policy        | Separate `workspace_key` table | Keys are cross-cutting (policy + scheduling + payroll). Policies are governance only.  |
| Key per workspace vs global catalog    | Per workspace                  | Each restaurant defines their own capabilities. No global standard.                    |
| Pay modifier on key vs separate table  | On key directly                | Simple. One key = one modifier. If a key has multiple modifiers, create multiple keys. |
| Shift requirement via tags vs FK       | Tags array                     | Flexible. Shifts already have `zone` and `role` text fields. Tags are additive.        |
| Key sets vs just individual assignment | Both                           | Sets for quick onboarding ("make them a Bartender"). Individual for exceptions.        |

## Not In Scope

- UI implementation (Phase 2+)
- Enforcement in scheduling or operations (Phase 4+)
- Payroll calculation engine (Phase 5)
- Key analytics or reporting
- Key approval workflows (admin grants directly, no approval chain)
- Time-scoped keys per shift (keys are profile-level, not shift-level)

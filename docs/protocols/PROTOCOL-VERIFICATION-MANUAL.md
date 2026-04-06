---
title: "Protocol Verification Engine — User Manual"
status: draft
updated: 2026-03-29
created: 2026-03-29
module: testing
tags: [protocol, verification, manual, e2e, playwright]
---

# Protocol Verification Engine — User Manual

## What This Is

The Protocol Verification Engine executes Smartout's Protokoll packages (Journey + Mission + Roadmap + License) as automated Playwright tests. Each run produces 4 outputs:

1. **Test results** — per-step pass/fail with gate verification
2. **User guide** — screenshots + step descriptions as markdown
3. **Mission draft** — AI agent instruction targeting engine_missions/engine_stages (always `is_active: false`)
4. **UX audit** — timing data and friction analysis

## Architecture

```
docs/Protokol/{package}/          Protocol definitions (TypeScript)        Playwright runner
  Journey.md                        apps/e2e/protocols/                      apps/e2e/runners/
  Mission.md          ──reads──>      P-001-admin-onboarding.ts  ──drives──>  protocol-runner.ts
  Roadmap.md                          schema.ts (Zod validation)              gate-checker.ts
  License.md                          types.ts (output shapes)
                                                                                    │
                                                                                    ▼
                                                                           Generators (post-run)
                                                                             apps/e2e/generators/
                                                                               docs-generator.ts
                                                                               mission-generator.ts
                                                                               audit-generator.ts
                                                                                    │
                                                                                    ▼
                                                                           4 outputs written to
                                                                             docs/guides/
                                                                             docs/missions/
                                                                             docs/audits/
                                                                             journey_test_run (DB)
```

## Roles

| Role                  | Who                                                | Does what                                                            |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| **Protocol Author**   | Developer or `protocol-writer` agent               | Writes TypeScript protocol definitions from Protokoll markdown       |
| **Protocol Runner**   | Developer, CI, or agent                            | Executes `pnpm --filter e2e test:protocol`                           |
| **Output Reviewer**   | Pontus, supervisor agent, or system-steward        | Reviews generated missions/docs/audits before they go live           |
| **Testid Maintainer** | Build agent or developer working on that component | Adds `data-testid` attributes when protocol run reports them missing |

In practice, one person or agent can wear multiple hats. The roles define responsibilities, not organizational boundaries.

---

## How to Write a New Protocol Definition

### 1. Read the Protokoll package

Every protocol maps to a package in `docs/Protokol/{package-name}/`. Read all 4 files:

- **Journey.md** — step-by-step user experience (your primary source)
- **License.md** — verification gates (what must be true after each step)
- **Roadmap.md** — scope, events, acceptance criteria
- **Mission.md** — AI agent behavior (used by the mission generator)

### 2. Create the TypeScript definition

Create a new file in `apps/e2e/protocols/`:

```
apps/e2e/protocols/P-XXX-{kebab-name}.ts
```

Import and follow the schema:

```typescript
import type { ProtocolDefinition } from "./schema";

export const P_XXX_NAME: ProtocolDefinition = {
  id: "P-XXX",
  package_id: "JP-RXXX-PACKAGE-NAME",
  name: "Human Readable Name",
  actor: "owner", // owner | admin | manager | employee
  platform: "web", // web | mobile
  auth_profile: "admin", // admin | employee | godmode
  entry_url: "/login",
  preconditions: { db_state: [] },
  steps: [
    {
      id: "1_step_name",
      order: 1,
      title: "Norwegian step title",
      description: "What this step does — used in generated docs.",
      actions: [
        { type: "navigate", url: "/some-page" },
        { type: "fill", testid: "input-name", value: "Test Value" },
        { type: "click", testid: "submit-btn" },
      ],
      gate: {
        type: "db_record",
        table: "workspace",
        where: { workspace_id: "{{fixture.workspace_id}}" },
        expect: { onboarding_completed: true },
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
  ],
  success_gate: {
    type: "url_match",
    pattern: "/dashboard",
    timeout_ms: 5_000,
  },
};
```

### 3. Register in the test file

Add the import to `apps/e2e/tests/protocol.spec.ts`:

```typescript
import { P_XXX_NAME } from "../protocols/P-XXX-{kebab-name}";

test.describe("journey:{slug}", () => {
  test("P-XXX: Name — full journey", async ({ page }) => {
    test.slow();
    const result = await runProtocol(page, P_XXX_NAME);
    // ... assertions
  });
});
```

### Action types reference

| Type           | Fields            | What it does                           |
| -------------- | ----------------- | -------------------------------------- |
| `navigate`     | `url`             | `page.goto(url)`                       |
| `fill`         | `testid`, `value` | `page.getByTestId(testid).fill(value)` |
| `click`        | `testid`          | `page.getByTestId(testid).click()`     |
| `click_text`   | `text`            | `page.getByText(text).first().click()` |
| `wait_visible` | `testid`          | Wait for element to appear             |
| `wait_hidden`  | `testid`          | Wait for element to disappear          |
| `settle`       | `ms`              | Wait for animations (default 1500ms)   |

### Gate types reference

| Type        | Fields                     | What it checks                        |
| ----------- | -------------------------- | ------------------------------------- |
| `db_record` | `table`, `where`, `expect` | Queries Supabase, checks field values |
| `ui_state`  | `testid`, `visible`        | Element visible/hidden in DOM         |
| `url_match` | `pattern`                  | Browser URL matches regex             |

### Variables

Use `{{auth.email}}`, `{{auth.password}}`, `{{fixture.workspace_id}}` etc. These are interpolated at runtime from E2E fixture data.

---

## How to Run Protocols

### Locally

Prerequisites:

- Supabase local running (`npx supabase start`)
- Web app running on port 3060 (`pnpm --filter web dev`)

```bash
# Run all protocols
pnpm --filter e2e test:protocol

# Run with Playwright UI (visual debugger)
cd apps/e2e && SKIP_WEB_SERVER=1 npx playwright test tests/protocol.spec.ts --ui

# Run a specific protocol test
cd apps/e2e && SKIP_WEB_SERVER=1 npx playwright test tests/protocol-login.spec.ts --project=web
```

Environment variables needed:

- `SUPABASE_URL` — defaults to `http://127.0.0.1:54321`
- `SUPABASE_SERVICE_ROLE_KEY` — required for DB gate checks
- `E2E_EMAIL` — defaults to `admin@smartout.local`
- `E2E_PASSWORD` — defaults to `password123`
- `SKIP_WEB_SERVER=1` — if you already have the web app running

### In CI

Not yet configured. When added, the CI job will:

1. Start Supabase local
2. Build web app
3. Run `pnpm --filter e2e test:protocol`
4. Upload screenshots as artifacts

---

## How to Review Generated Outputs

After a protocol run, check these locations:

| Output           | Path                                     | Action needed                                                     |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| **Guide**        | `docs/guides/GUIDE-P-XXX.md`             | Review text, verify screenshots show correct state                |
| **Mission**      | `docs/missions/MISSION-DRAFT-P-XXX.json` | Review stages, enrich instructions, then convert to migration SQL |
| **Audit**        | `docs/audits/AUDIT-P-XXX-{date}.md`      | Read timing data, identify slow steps                             |
| **Test results** | `journey_test_run` table                 | Query for `test_type = 'protocol'`                                |

### Mission review checklist

Generated missions are always drafts (`is_active: false`). Before making one live:

- [ ] Review `system_prompt` — replace `[HUMAN REVIEW REQUIRED]` placeholders
- [ ] Verify `success_criteria` on each stage matches actual UI behavior
- [ ] Add tool references (`tool_hints`) based on what the agent needs
- [ ] Set `creative_freedom` per stage (0.0 = strict, 1.0 = freestyle)
- [ ] Write migration SQL to insert into `engine_missions` + `engine_stages`
- [ ] Get ADR approval if this is a new mission type

---

## How to Fix Missing Testids

When a protocol run fails because a `data-testid` attribute is missing, the error will say:

```
Step "Velkomstskjerm" TIMEOUT: Element [data-testid="onboarding-hero"] not found
```

To fix:

1. Find the component: `grep -r "onboarding-hero" apps/web/src/` (probably doesn't exist yet)
2. Find the actual component that renders at that point in the flow
3. Add `data-testid="onboarding-hero"` to the root element
4. Commit with: `test(protocol): add data-testid for P-001 step 3`

### Naming convention for testids

```
{flow}-{element-type}-{identifier}
```

Examples:

- `login-email` — email input on login page
- `login-submit` — submit button on login page
- `onboarding-step-business` — root container of business step
- `onboarding-next-btn` — next/continue button in wizard
- `confirm-finalize-button` — finalize button in summary step

---

## Troubleshooting

### "supabaseKey is required"

`SUPABASE_SERVICE_ROLE_KEY` is not set. Run `npx supabase status` to get it.

### Gate timeout on db_record

The expected DB record doesn't exist. Check:

- Is the `where` clause correct?
- Did the previous step actually create the record?
- Is RLS blocking the service role query? (Shouldn't — service role bypasses RLS)

### Screenshots are blank/white

The screenshot is taken after the page navigated away. The settle delay may need increasing, or the screenshot should be taken before the gate check triggers navigation.

### "No journey found" warning

The protocol's `package_id` doesn't match any `journey.code` or `journey.slug` in the database. This is non-fatal — test results just aren't persisted to `journey_test_run`. Seed the journey record if you want persistence.

### Next.js dev overlay blocks clicks

The Next.js error overlay in dev mode intercepts pointer events. The protocol runner should dismiss it. If not, add a `settle` action with a higher delay, or dismiss manually.

---

## Maintenance

### When UI changes

1. Run the affected protocol — it will fail on the changed step
2. Update the protocol definition to match the new UI
3. Update the Journey.md if the flow changed (not just visual)
4. Re-run to verify

### When adding a new Protokoll package

1. Write the 4 markdown files in `docs/Protokol/{package-name}/`
2. Write the TypeScript protocol definition
3. Add to `protocol.spec.ts`
4. Run and iterate until all gates pass
5. Review generated outputs

### Periodic health check

Run all protocols weekly. If any fail:

- UI drift → update protocol definition
- Missing testid → add testid to component
- Flow change → update Journey.md + protocol definition + re-run generators

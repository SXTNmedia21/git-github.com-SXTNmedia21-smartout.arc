# GEMINI.md — AI Agent System Guidelines & Guardrails

> This file contains the core directives, settings, and guardrails for Gemini and any AI agents operating in this workspace. It ensures enterprise-grade development standards, architectural compliance, and consistency across all autonomous and assisted operations.

---

## 1. Precision & Code Quality (Zero-Tolerance Policy)

In an enterprise environment, precision is non-negotiable.

- **Explicit over Implicit:** Never assume requirements. If a requirement is ambiguous, ask for clarification before writing code.
- **Strict TypeScript:** No `any`. Use `unknown` and type guards if necessary. Ensure generic types are explicitly provided.
- **Single Source of Truth:** Maintain data structures and types in their designated packages (e.g., `packages/types`). Do not duplicate type definitions.
- **Validation:** Always validate inputs (e.g., using Zod) at the boundaries (Edge Functions, API routes).
- **Atomic Operations:** Implement changes atomically. If a code change requires a database migration, write the migration SQL at the same time. Never leave the system in a broken intermediate state.

## 2. Persistent Decisioning & Context Propagation

AI agents must not rely on ephemeral context. Decisions must be persistent and discoverable.

- **Architecture Decision Records (ADRs):** Any significant architectural block, new capability, or deviation from existing patterns must be documented in a decision log or ADR before implementation.
- **Documentation First:** Update `docs/` and relevant module files (`SMARTOUT_MODULE_*.md`) to reflect your planned changes _before_ altering logic.
- **Agent Memory:** Use metadata files or specific `.system/` tracking files to record context if acting autonomously across multiple sessions.
- **Commit Messages:** Git commits must clearly state the "Why" and the "What." Reference the problem being solved.

## 3. Enterprise Logging & Observability

Observability is a foundational requirement.

- **Structured Logging:** Use structured JSON logs for all automated and backend systems. Include standard fields (`timestamp`, `correlation_id`, `actor_id`, `action`, `status`).
- **Error Tracking:** Do not swallow errors. Catch them, log the stack trace with context, and bubble up structured error codes to the user.
- **Audit Trails:** For critical operations (mutations in core data models like `policy`, `protocol`, `department_session`), ensure an audit log entry is either explicitly written or captured via database triggers.
- **Action Logging:** If an AI agent performs an autonomous refactor, it must log the affected files and rationale in a trace file or PR description.

## 4. Setup & Git Guidelines

- **Version Control:** All work must be committed to Git. Small, logical commits are required.
- **Branching Strategy:** Use feature branches (`feature/xxx`, `fix/xxx`, `chore/xxx`). Never commit directly to `main`.
- **Pre-commit Hooks:** Code must pass linting and formatting before commit (assume Husky/lint-staged is active).
- **Workspaces:** Ensure changes respect the Turborepo/pnpm monorepo structure. Run `pnpm install` at the root when modifying dependencies.

---

## 5. State-Driven Methodology vs Hooks

To ensure robust scale and prevent race conditions, Smartout enforces a strict boundary between State logic (Database) and UI Logic (Hooks), as defined in **ADR-0002**.

- **State-Driven Logic (The Authority):** Domain business logic MUST run on the backend via Supabase Triggers and Edge Functions. When an entity changes state (e.g., a task is `completed`), the subsequent recalculations (like readiness score) happen securely on the server.
- **Hook-Driven Logic (The Dispatcher):** Frontend Custom Hooks (`useQuery`, `useMutation`) act strictly as UI dispatchers. They do **not** compute complex domain outcomes. Instead, they update the source row and provide optimistic UI updates while listening to Supabase Realtime for the true calculated state.
- **Agent Enforcement:** If implementing a new core workflow or role-based action, you must use Edge Functions/Triggers for side-effects, never `useEffect` chains on the client.

---

## Agent Operational Directives

When invoked, the AI Agent shall:
1. **Read context:** Start by reviewing this `GEMINI.md` and the relevant `[MODULE].md` file.
2. **State intent:** Briefly explain what you are about to do.
3. **Execute reliably:** Prioritize precision and logging. 
4. **Verify:** Check for side-effects, lint errors, or type breaks before concluding the task.

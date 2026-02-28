# Contributing to SmartOut.ai

Welcome! We are excited you are interested in contributing to **SmartOut.ai**. Our project adheres strictly to **enterprise-grade development standards**, robust logging, and state-driven architecture patterns.

## 🤝 Code of Conduct

All contributors (human and AI) are expected to read and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## 🛠️ Development Guidelines

To ensure code quality and consistency across all operations, our platform has a "Zero-Tolerance Policy" for architectural ambiguity. See `CLAUDE.md` for ground truth and `docs/INDEX.md` for the full documentation map.

### 1. **Precision & Code Quality**

- **Strict TypeScript:** Do not use `any`. Define strong types from `packages/types/` and use type guards or `unknown`.
- **Atomic Operations:** Code and database migrations must be synced and atomic. Do not leave the system in an intermediate state.
- **Data Validation:** Use Zod for validating all edge boundaries (API Routes, Edge Functions).

### 2. **Persistent Decisioning**

- Maintain Architecture Decision Records (ADRs) in `docs/decisions/`.
- Update the relevant module documentation (e.g., `docs/modules/SMARTOUT_MODULE_*.md`) BEFORE implementing a change that alters core business logic.
- All docs have YAML frontmatter with `id`, `status`, `depends_on` — read frontmatter + Summary to assess relevance before loading full files.
- Quick-lookup references: `docs/reference/DATABASE.md`, `ROUTES.md`, `PACKAGES.md`, `ENV_VARS.md`.
- Commit messages must clearly state "Why" and "What." Reference issue numbers if available.

### 3. **The 'State-Driven' Rule**

- Domain logic runs securely on the backend via **Supabase Edge Functions and Triggers** (State-Driven Logic).
- Frontend hooks (`useQuery`, `useMutation`) serve strictly as dispatchers without carrying out heavy data calculations. Do not use chained `useEffect` responses.

## 🌱 Getting Started

1. **Find an Issue**: Ensure there is an open issue for your problem, or propose one first so we can discuss the approach.
2. **Branching Strategy**:
   - `feature/{name}` for new capabilities.
   - `fix/{name}` for bug fixes.
   - `chore/{name}` for refactors and maintenance.
     _(Please do not commit directly to `main`!)_
3. **Set Up the Repo**: Review `README.md` for getting your local Turborepo/pnpm environment running.
4. **Prepare the PR**:
   - Ensure all linters are passing (`pnpm lint`).
   - Run tests if available.
   - We utilize Husky and lint-staged hooks for pre-commit verification. Please ensure those pass locally.

## 💬 Opening a Pull Request

We use a standard PR Template (located at `.github/PULL_REQUEST_TEMPLATE.md`). Please fill in all prompted sections to provide the architectural and testing context for your changes!

We look forward to building with you. Thank you for contributing!

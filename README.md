# SmartOut.ai

Welcome to **SmartOut.ai**, an enterprise-grade, intelligent workforce and workspace management platform.

SmartOut.ai is built with a state-driven methodology, enforcing a strict boundary between robust backend business logic (driven by Supabase edge functions and database triggers) and modern, interactive frontend interfaces (Next.js & React).

## 🚀 Features

- **Intelligent Workspaces & Onboarding:** Advanced organization structure generation using an AI-assisted wizard. Establish roles, departments, and communication channels instantly.
- **State-Driven Architecture:** Complex domain logic is executed securely on the server (Supabase Edge Functions/Triggers). The client strictly acts as a dispatcher for predictable, race-condition-free state management.
- **Enterprise Observability:** Complete structured JSON logging for all active systems, tracking actions, correlation IDs, and status.
- **AI Agent Capabilities:** Built-in AI assistants capable of gathering intelligence, executing workflow setup, and automating manual processes.

## 🛠️ Tech Stack

- **Monorepo:** Turborepo & pnpm
- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui
- **Backend/Database:** Supabase (PostgreSQL, Edge Functions, Row Level Security)
- **Validation:** Zod
- **Infrastructure:** Vercel & Supabase Cloud

## 📦 Getting Started

### Prerequisites

- Node.js >= 18
- [pnpm](https://pnpm.io/) >= 9
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- 1Password CLI (optional, but configured in package scripts `op run`)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/SXTNmedia21/smartout.ai.git
   cd smartout.ai
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   Copy `.env.example` (or `.env.template`) to `.env.local` and fill in your connection variables for local development.

### Development

Run the frontend app locally:

```bash
pnpm run dev:local
```

For full environment deployment using 1Password secrets injection:

```bash
pnpm run dev
```

Build the project:

```bash
pnpm run build
```

### Local Database Setup (Supabase)

```bash
supabase start
supabase db reset
```

## 📚 Documentation

The `docs/` folder contains comprehensive Architecture Decision Records (ADRs) and module descriptions.

Key starting points:

- `docs/architecture/smartout-full-index-v2.md`
- `GEMINI.md` / `CLAUDE.md` (AI Agent system guidelines & coding standards)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

For AI Agents and human developers alike: **Precision is non-negotiable**. Refer to `GEMINI.md` for our strict TypeScript, validation, and zero-tolerance precision policies.

## 📝 License

Proprietary Software. Internal use for Genesis/SXTNmedia.

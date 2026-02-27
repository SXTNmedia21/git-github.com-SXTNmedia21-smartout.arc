# ADR-0003: UI Framework and Local Styling Strategy

**Date:** 2026-02-24
**Status:** Accepted

## Context

As we move into Phase 0.9 (Next.js Scaffold) of the Smartout Engine rebuild, we need to establish a clear standard for the UI configuration in our monorepo setup to ensure the frontend layers of the application are maintainable and scaleable. Specifically, we need a decision around how Shadcn/ui and Tailwind CSS should be installed and managed across the monorepo workspaces.

## Decision

We will use **Tailwind CSS v4** combined with a manual integration of **shadcn/ui** specifically within the `apps/web` project, rather than trying to abstract it into a generic `packages/ui`.

Since the automated `npx shadcn@latest init` CLI does not natively support complex `pnpm` monorepo workspaces without significant overhead, we will manage the `components.json` and install the necessary dependencies (`tailwindcss-animate`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`) manually per-app as needed.

## Consequences

### Positive

- **Simplicity:** Keeping the UI scope tied to the Next.js app (`apps/web`) reduces the complexity of cross-package linking for Next.js build cycles.
- **Compatibility:** Allows us to bypass `pnpm` workspace resolution errors when using raw CLI tools designed for single-project architectures.
- **Speed:** Faster iteration cycles for frontend components since they compile natively in the Next App Router.

### Negative

- App-specific boundaries mean if `apps/mobile` later requires similar UI configurations, some styling primitives may need to be duplicated rather than imported from a shared `packages/ui` library.

## Rationale

Given the difficulty of `shadcn/ui` interacting with Turborepo and `pnpm` workspaces (e.g. `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` errors when executing `npx shadcn init`), the most pragmatic approach to unblock development is to constrain the Shadcn setup to the consuming app. This aligns with Shadcn's underlying philosophy that its components are meant to be owned and modified by the consumer, not treated as strict external dependencies.

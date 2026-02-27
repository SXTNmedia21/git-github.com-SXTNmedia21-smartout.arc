# ADR-0010: AI SDK with OpenRouter Provider

**Date:** 2026-02-27
**Status:** Accepted

## Context

Smartout requires AI capabilities for onboarding agents, voice assistants, and future AI-powered features. We needed to choose an AI SDK and model provider strategy.

## Decision

We use the **Vercel AI SDK** (`ai` package) with **OpenRouter** as the model provider.

### Package Structure

AI logic lives in `packages/ai/` (`@smartout/ai`) as a shared package with:

- `agents/` — Agent definitions (e.g., onboarding agent)
- `tools/` — Tool definitions for function calling
- `schemas/` — Zod schemas for structured outputs
- `adapters/` — Platform adapters (Vercel AI for text, LiveKit for voice)

### Why Vercel AI SDK

- Framework-agnostic core with Next.js-optimized streaming
- Built-in tool calling, structured outputs, and multi-step agents
- `generateText()`, `generateObject()`, `streamText()` patterns
- Compatible with any OpenAI-compatible provider via adapters

### Why OpenRouter

- Access to multiple models (Claude, GPT-4, Gemini, open-source) through one API
- Automatic fallback and routing between providers
- Single API key, single billing relationship
- Easy model switching without code changes

## Rationale

- Vercel AI SDK matches our Next.js stack naturally
- OpenRouter gives model flexibility without vendor lock-in
- Shared `@smartout/ai` package keeps AI logic out of app code and testable independently

## Consequences

- `OPENROUTER_API_KEY` required for AI features (validated in env.ts)
- Agent definitions must use Zod schemas for all inputs/outputs
- Voice features use LiveKit adapter, text features use Vercel AI adapter

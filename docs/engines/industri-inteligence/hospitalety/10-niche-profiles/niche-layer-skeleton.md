---
title: Niche Layer Skeleton
id: ENGINE_NICHE_LAYER_SKELETON
version: "0.1"
status: draft
layer: niche
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - niche
  - skeleton
  - showcase
---

# Niche Layer Skeleton

## 1) What Niche Means

**Niche** is the business specialization profile inside one industry.

Example:  
Industry = restaurant  
Niche = italian + premium + quality-service

## 2) Position in the Engine

The niche layer sits between industry baseline and execution.

`Industry baseline -> Niche profile -> Role capability weighting -> Journey/testing focus`

## 3) What a Niche Profile Must Define

At minimum:

- Niche identity (`niche_id`, labels, summary)
- Operating model assumptions
- Experience and quality level
- Priority weights (speed/quality/compliance/etc.)
- Persona emphasis multipliers
- Role capability emphasis multipliers
- Journey focus multipliers
- Testing focus multipliers

## 4) Why this is a core system piece

This layer is the **glue** between strategy and behavior:

- Strategy: what kind of business this is
- Behavior: what users, agents, and workflows must prioritize

Without niche, the system can classify industry but still miss business reality.

## 5) How weights are used

Weights are simple multipliers (start minimal):

- `1.0` = baseline
- `>1.0` = emphasize
- `<1.0` = de-emphasize

Suggested initial range: `0.7` to `1.5`

## 6) Core Mapping Targets

A niche profile should map into:

- AI council persona priorities
- Role capability and training priorities
- Policy strictness and visibility priorities
- Journey sequencing and guardrail priorities
- Automated/manual/A-B/security testing priorities

## 7) Keep-it-simple rules

- Keep this layer lightweight and interpretable.
- Avoid complex scoring models at foundation stage.
- Use a few meaningful multipliers over dozens of weak signals.
- Prefer explicit text rationale with each weight.

## 8) Implementation readiness checklist

A niche is foundation-ready when:

1. It has one clear business description.
2. Persona and role emphasis are defined.
3. Journey and testing focus are defined.
4. It is linked in relevance mapping and package index.

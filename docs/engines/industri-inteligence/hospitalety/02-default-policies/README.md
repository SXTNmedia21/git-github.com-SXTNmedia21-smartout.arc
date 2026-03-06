---
title: Default Policy Baseline
id: ENGINE_DEFAULT_POLICIES
version: "0.1"
status: draft
layer: governance
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - policy
  - governance
  - compliance
---

# Default Policy Baseline

## Purpose

Define non-optional policy categories an industry engine must provide before journeys are considered production-ready.

## Mandatory Policy Groups

1. Safety and compliance policies
2. Operational standard policies
3. Workforce and HR policies
4. Access and accountability policies
5. Incident and exception policies

## Policy Quality Requirements

Each policy should include:

- Scope (workspace, department, team)
- Enforcement mode (required, warning, advisory)
- Trigger context (when policy is evaluated)
- Verification method (how compliance is checked)
- Exceptions and escalation path
- Linked templates and journeys

## Relevance to Engine

- Policies are the guardrail layer between templates and execution.
- Templates define the intended flow; policies define acceptable flow.
- Tests should always assert both functional output and policy compliance output.

## Restaurant Baseline Link

Restaurant policy seeds already exist in Supabase templates and should be treated as initial canonical baseline for this engine package.

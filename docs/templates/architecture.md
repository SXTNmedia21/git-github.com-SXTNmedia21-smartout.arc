---
title: "[System/Feature Name]"
id: ARCH_SHORT_ID
version: "1.0"
status: draft
layer: architecture
created: YYYY-MM-DD
updated: YYYY-MM-DD
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - [tag1]
  - [tag2]
tables:
  - [table_name_if_applicable]
---

# [System/Feature Name]

## Overview

[1-2 paragraphs: what this system does and why it exists.]

## Architecture

### Components

| Component | Purpose        | Location               |
| --------- | -------------- | ---------------------- |
| [Name]    | [What it does] | [File path or service] |

### Data Model

[Tables, relationships, key columns. Include SQL snippets if new tables.]

### Flow

[Sequence or flow description — how data moves through the system. Use numbered steps or a diagram.]

1. [Step 1]
2. [Step 2]
3. [Step 3]

## API / Interface

[Endpoints, functions, or contracts exposed by this system.]

| Method          | Route / Function | Purpose        |
| --------------- | ---------------- | -------------- |
| [GET/POST/etc.] | [path]           | [what it does] |

## Security

[Auth, RLS, access control, secrets handling — anything security-relevant.]

## Dependencies

[External services, packages, other modules this depends on.]

## Open Questions

- [ ] [Unresolved design question, if any]

---

> After writing: add to `docs/INDEX.md` under Architecture.

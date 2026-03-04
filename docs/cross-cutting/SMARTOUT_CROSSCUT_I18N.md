---
title: "Internationalization (i18n)"
id: XCUT_I18N
version: "1.0"
status: canonical
layer: cross-cutting
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - i18n
  - localization
  - languages
  - norwegian
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Cross-Cutting: Internationalization (i18n)

> **Smartout.ai** — Cross-cutting documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Section 27

---

## 1. Language Support

| Language       | Code | Status  |
| -------------- | ---- | ------- |
| Norsk (Bokmål) | no   | Primary |
| Svenska        | sv   | Planned |
| English        | en   | Planned |
| Dansk          | da   | Planned |
| Suomi          | fi   | Planned |

## 2. Language Resolution

```
Profile.language_override (if set)
  → Workspace.language (workspace default)
    → Company.default_language (company default)
      → User.preferred_language (personal preference)
```

## 3. Content Translation

- UI strings: i18n key files per language
- User-generated content (policies, procedures): stored in original language
- AI (Mr. Botsson): generates responses in user's preferred language
- Notifications: rendered in recipient's language

## 4. Implementation Rules

- Never hardcode Norwegian text — use i18n keys
- All user-facing strings go through the i18n system
- Date/time formatting follows locale conventions
- Currency formatting follows workspace currency setting
- Number formatting (decimal separator, thousands) per locale

---

_Norwegian is the primary language and will be implemented first. Other languages are on the roadmap. The i18n infrastructure should be built from day one even if only Norwegian keys exist initially._

---
title: "Worklog — onboarding-redesign"
status: done
updated: 2026-03-11
created: 2026-03-03
module: onboarding
tags: [onboarding, scroll, animations, voice, ux]
---

# Worklog — onboarding-redesign

> Branch: `feat/onboarding-redesign` | Worktree: wt-2 | Started: 2026-03-03

## Status: :green_circle: Done

## Done

- [x] Replace 15-step wizard types with 6-section scroll model
- [x] Add industry-based department defaults with NACE mapping
- [x] Add scrape + Brreg data merger utility
- [x] Add season suggestion engine based on current date
- [x] Add design tokens and Instrument Serif display font
- [x] Add useScrollProgress hook with IntersectionObserver
- [x] Add ParallaxBackground with gradient orbs
- [x] Add SectionReveal, TypewriterText, DataMaterializer animations
- [x] Add Mr. Botsson voice scripts, hook, and floating avatar
- [x] Build 6 scroll sections (Hero, Business, Season, Departments, Contract, Done)
- [x] Assemble scroll-based page with progress bar
- [x] Update WizardContext for scroll-based state model
- [x] Add useOnboardingState hook with scraping and session persistence
- [x] Wire Mr. Botsson voice triggers to scroll sections
- [x] Fix voice race condition and autoplay policy
- [x] Resolve 6 TypeScript strict-mode errors
- [x] UI polish: controlled scroll, soft borders, entrance animations
- [x] Performance: remove all blur/backdrop-blur, compositor-only animations
- [x] Redesign login: Google SSO primary, collapsible email form
- [x] Add reset button with proper state + DB session cleanup
- [x] Add AgentCard component for voice agent inspection
- [x] Wire mission registry for onboarding-interview mission

## Remaining

- None

## Decisions

| Date       | Decision                                                                                  | Reason                                               |
| ---------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2026-03-07 | Replace 15-step wizard with 6-section scroll layout                                       | Simpler UX, fewer clicks, better visual flow         |
| 2026-03-10 | Controlled scroll (overflow:hidden + touch-action:none), programmatic scrollIntoView only | Prevent user from scrolling past incomplete sections |
| 2026-03-10 | GPU performance: only animate opacity + translateY, no blur/scale/backdrop-blur           | Eliminate jank from stacked translucent layers       |
| 2026-03-10 | Luxury easing curve [0.16, 1, 0.3, 1] for all animations                                  | Fast start, slow deceleration = premium feel         |
| 2026-03-10 | Google SSO as primary login action, collapsible email form                                | Reduce friction, most users have Google              |
| 2026-03-11 | Reset button clears all state + deletes DB session (not just page reload)                 | Clean restart without stale data persisting          |

## Log

| Date       | Time  | Event                                                             |
| ---------- | ----- | ----------------------------------------------------------------- |
| 2026-03-03 | 10:00 | Feature started                                                   |
| 2026-03-07 |       | 17 initial commits: types, utilities, hooks, components, sections |
| 2026-03-10 |       | UI polish session: controlled scroll, soft borders, performance   |
| 2026-03-10 |       | Login redesign: Google SSO + collapsible email                    |
| 2026-03-10 |       | Fixed duplicate React key bug in addCustomDepartment              |
| 2026-03-11 |       | Added reset function with DB session cleanup                      |
| 2026-03-11 |       | Added AgentCard + mission registry integration                    |
| 2026-03-11 |       | Closure: WORKLOG, decisions, learnings, journey docs              |

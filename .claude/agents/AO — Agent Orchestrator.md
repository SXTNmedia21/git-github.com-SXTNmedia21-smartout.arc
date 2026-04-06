AO — Agent Orchestrator Start Guide

ComposioHQ Agent Orchestrator for parallell Claude Code-eksekvering
Prosjekt: Smartout · Stack: tmux + claude-code + worktree

Forutsetninger
Sjekk at alt er på plass før du starter:
bash# Verifiser AO CLI
ao --help

# Verifiser tmux

tmux -V

# Verifiser Claude Code

claude --version

# Verifiser Git + GitHub CLI

git --version && gh auth status
Hvis ao ikke finnes → re-link:
bashcd ~/dev/ComposioHQ/packages/cli
pnpm link --global

Config-fil
Ligger i: ~/dev/smartout.ai/agent-orchestrator.yaml
yamldataDir: ~/.agent-orchestrator
worktreeDir: ~/.worktrees
port: 1337
defaults:
runtime: tmux
agent: claude-code
workspace: worktree
notifiers: - desktop
projects:
smartout-ai: # ← IKKE bruk punktum i ID
name: smartout-ai
sessionPrefix: sma
repo: SXTNmedia21/smartout.ai
path: /home/sxtnl/dev/smartout.ai
defaultBranch: development # ← IKKE main
Viktig: Prosjekt-ID kan IKKE inneholde punktum. Bruk smartout-ai, ikke smartout.ai.

Start
bash# 1. Gå til prosjektet
cd ~/dev/smartout.ai

# 2. Start orchestrator + dashboard

ao start
Dashboard åpnes på: http://localhost:1337

Daglig workflow
Spawne en agent
bash# Spawn mot en oppgave
ao spawn smartout-ai "beskriv-oppgaven-her"

# Spawn mot Linear issue

ao spawn smartout-ai SMA-123
Hva skjer:

Ny git worktree opprettes (isolert branch)
Ny tmux-session startes
Claude Code kjøres automatisk i worktreen

Spawne flere agenter parallellt
bashao batch-spawn smartout-ai SMA-101 SMA-102 SMA-103
Sjekke status
bashao status
Viser: branch, aktivitet, PR-status, CI-status per agent.
Sende melding til en aktiv agent
bashao send <session-navn> "Dropp det, fokuser på auth-modulen"
Se dashboard
bashao dashboard
Håndtere sessions
bash# Liste alle
ao session ls

# Drepe én

ao session kill <session-navn>

# Rydde opp døde sessions

ao session cleanup
Stoppe alt
bashao stop

Regler for agentene
Hver spawnet agent leser CLAUDE.md fra repoet automatisk. Dine regler, konvensjoner og protokoller gjelder for alle agenter uten ekstra config.
Orchestrator Mode (legg til i CLAUDE.md)
Når du kjører ao start, blir Claude Code en orkestrator — den planlegger og delegerer, den implementerer IKKE selv.
markdown## Orchestrator Mode

When started via `ao start`, you are the ORCHESTRATOR.
Your role is to plan, coordinate and delegate — NEVER implement.

### Rules

- You NEVER write code, edit files, or run lint/build/test yourself
- You analyze tasks and break them into subtasks
- You use `ao spawn smartout-ai "<task>"` to create worker agents
- You monitor progress with `ao status`
- If you catch yourself implementing — STOP and spawn a worker

### Worker Instructions

When spawning, always include:

- What specific files/modules to touch
- What "done" looks like (tests pass, lint clean, etc.)
- "When finished, create a PR and report back"

### Session Log

- Start: read docs/SESSION.md for context
- During: log decisions and delegations
- End: update docs/SESSION.md with status and blockers

Filgrenser = ingen konflikter
Før du spawner parallelle agenter:

Definer filgrenser — Agent A eier /components/auth/_, Agent B eier /components/schedule/_
Null overlapp — Ingen to agenter rører samme filer
Merge-rekkefølge — Bestem på forhånd: Agent A merger først → typecheck → Agent B merger
Typecheck mellom merges — pnpm tsc --noEmit må passere

Feilsøking
ProblemLøsningao: command not foundcd ~/dev/ComposioHQ/packages/cli && pnpm link --globalInvalid projectIdFjern punktum fra prosjekt-ID i yamlUnknown projectSjekk at ID i yaml matcher kommandoenAgent skriver kode selvLegg til Orchestrator Mode i CLAUDE.mdSlack/webhook warningsIgnorer — desktop notifier funker uten configWorktree-konflikterao session cleanup + git worktree prune

Hurtigreferanse
ao start → Start orkestrator + dashboard
ao stop → Stopp alt
ao spawn smartout-ai "oppgave" → Ny agent-session
ao batch-spawn smartout-ai A B C → Flere agenter
ao status → Oversikt alle agenter
ao send <session> "melding" → Instruks til aktiv agent
ao session ls / kill / cleanup → Sesjonshåndtering
ao dashboard → Web-UI på :1337
ao review-check → Sjekk PRs for review-kommentarer

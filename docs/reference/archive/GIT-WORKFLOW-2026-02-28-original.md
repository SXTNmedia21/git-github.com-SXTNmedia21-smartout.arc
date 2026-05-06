---
title: "Git + Vercel + Cursor — Komplett Workflow"
id: GIT_WORKFLOW
version: "1.0"
status: canonical
layer: reference
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - git
  - vercel
  - workflow
  - branching
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Git + Vercel + Cursor — Komplett Workflow

## Nyckelkoncept (bara det du behöver veta)

| Term          | Vad det är                                                                                |
| ------------- | ----------------------------------------------------------------------------------------- |
| `main`        | Din produktionsbranch. Det som körs på smartout.ai. Ingen pushar hit direkt.              |
| `development` | Din dagliga arbetsbranch. Här bygger du saker.                                            |
| `feature/*`   | Tillfälliga branches för specifika uppgifter. Skapas från `development`, mergas tillbaka. |
| `hotfix/*`    | Akuta fixar som går direkt till `main` (enda undantaget).                                 |
| `origin`      | **Inte en branch.** Bara adressen till din GitHub-remote.                                 |
| `HEAD`        | Pekar på den branch du är på just nu. Inget du behöver tänka på.                          |
| PR            | Pull Request. Den enda vägen in till `main`.                                              |

---

## Branch-flöde

```
feature/x ──→ development ──→ PR till main ──→ Vercel preview ──→ merge ──→ LIVE
                                                    ↑
                                        Du testar här innan merge

hotfix/x ────────────────→ PR till main ──→ Vercel preview ──→ merge ──→ LIVE
                           (cherry-pick tillbaka till development)
```

---

## Environment Variables — Hur Vercel hanterar nycklar

### Grundprincip

**Du har INGA .env-filer i repot.** Alla nycklar lever i Vercel Dashboard.

Vercel har tre inbyggda miljöer:

| Vercel-miljö    | Aktiveras av                  | Domän                                     |
| --------------- | ----------------------------- | ----------------------------------------- |
| **Production**  | Push/merge till `main`        | `smartout.ai`                             |
| **Preview**     | Varje PR / varje annan branch | `smartout-ai-xxx.vercel.app` (automatisk) |
| **Development** | `vercel dev` lokalt           | `localhost:3000`                          |

### Sätta upp nycklar i Vercel Dashboard

**Vercel → Project → Settings → Environment Variables**

För varje nyckel väljer du vilka miljöer den gäller:

```
SUPABASE_URL
  ☑ Production  → https://xxx.supabase.co       (prod-instans)
  ☑ Preview     → https://yyy.supabase.co       (dev/test-instans)
  ☑ Development → https://yyy.supabase.co       (samma som preview)

SUPABASE_SERVICE_ROLE_KEY
  ☑ Production  → eyJ...prod-nyckel
  ☑ Preview     → eyJ...dev-nyckel
  ☑ Development → eyJ...dev-nyckel

STRIPE_SECRET_KEY
  ☑ Production  → sk_live_xxx
  ☑ Preview     → sk_test_xxx
  ☑ Development → sk_test_xxx
```

**Resultatet:** Koden är identisk i alla branches. Vercel injicerar rätt nycklar baserat på vilken miljö deployen körs i. Du behöver aldrig byta nycklar manuellt.

### Hämta nycklar till lokal utveckling

```bash
# Installera Vercel CLI
npm i -g vercel

# Länka ditt projekt (en gång)
vercel link

# Hämta development-nycklar till .env.local
vercel env pull .env.local
```

`.env.local` är redan i `.gitignore` — den committas aldrig.

---

## Nyckelrotation — Steg-för-steg

Vercel-rekommenderad procedur:

```
1. Generera ny nyckel hos tredjeparten (Supabase, Stripe, etc.)
   ⚠️ Invalidera INTE den gamla ännu

2. Uppdatera nyckeln i Vercel Dashboard
   → Settings → Environment Variables → Edit

3. Redeploya
   → Deployments-tabben → Senaste production → ⋯ → Redeploy

4. Verifiera att allt fungerar med nya nyckeln

5. NU invalidera/ta bort gamla nyckeln hos tredjeparten

6. Uppdatera lokal .env.local
   → vercel env pull .env.local
```

**Varför denna ordning?** Om du invaliderar den gamla nyckeln först, går din site ner tills du hinner deployer om. Med denna ordning finns noll downtime.

---

## GitHub Branch Protection — Setup

### Steg 1: Gå till GitHub

`Repo → Settings → Branches → Add branch protection rule`

### Steg 2: Konfigurera för `main`

```
Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals: 1  (du reviewar din egen PR)

☑ Require status checks to pass before merging
  → Sök och lägg till: "Vercel" (deployment check)

☑ Do not allow bypassing the above settings
  ⚠️ VIKTIG — utan denna kan du som admin fortfarande pusha direkt

☑ Restrict who can push to matching branches
  → Ingen (allt måste gå via PR)
```

### Steg 3: Testa att det fungerar

```bash
git checkout main
echo "test" >> test.txt
git add . && git commit -m "test"
git push origin main
# → Ska NEKAS av GitHub
```

Ta bort test-filen efteråt.

---

## Dagligt Cursor-arbete

### Starta ny uppgift

```bash
# Byt till development och hämta senaste
git checkout development
git pull origin development

# Skapa feature-branch
git checkout -b feature/lisa-hub-voice-routing
```

### Jobba i Cursor, committa löpande

```bash
git add .
git commit -m "feat: add voice routing logic for Lisa Hub"
git push -u origin feature/lisa-hub-voice-routing
```

### När klart — öppna PR

1. **GitHub** → Repot → "Compare & pull request"
2. Base: `development` ← Compare: `feature/lisa-hub-voice-routing`
3. Merge till development
4. Testa development

### Release till produktion

1. **GitHub** → New Pull Request
2. Base: `main` ← Compare: `development`
3. Vercel skapar automatiskt en **preview-deployment**
4. Klicka preview-länken i PR:n → testa allt
5. Merge → Live på smartout.ai

### Hotfix (akut bugg i produktion)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/auth-crash

# Fixa buggen...

git add . && git commit -m "fix: auth crash on login"
git push -u origin hotfix/auth-crash

# Öppna PR direkt till main
# Efter merge, cherry-pick till development:
git checkout development
git cherry-pick <commit-hash>
git push origin development
```

---

## .cursor/rules fil

Skapa denna i repots rot:

```
# === GIT WORKFLOW ===
- NEVER commit or push directly to main
- Always work on development or feature/* branches
- All changes to main must go through a Pull Request
- Branch naming: feature/beskrivning, fix/beskrivning, hotfix/beskrivning
- Default working branch: development

# === ENVIRONMENT VARIABLES ===
- NEVER hardcode API keys, secrets, or credentials in code
- NEVER commit .env files — they are in .gitignore
- All env vars are managed in Vercel Dashboard (Settings → Environment Variables)
- Use process.env.VARIABLE_NAME to access them
- Vercel automatically injects correct values per environment (production/preview/development)

# === DEPLOYMENT ===
- main branch = production (smartout.ai)
- All other branches = Vercel preview deployments
- Always verify Vercel preview before merging to main
```

---

## Git Hook — Lokal säkerhet

Kör detta en gång i ditt repo (Windows/Git Bash):

```bash
mkdir -p .git/hooks
cat > .git/hooks/pre-push << 'EOF'
#!/bin/sh
while read local_ref local_sha remote_ref remote_sha; do
  if echo "$remote_ref" | grep -q "refs/heads/main"; then
    echo ""
    echo "🚫 STOPP: Direkt push till main är blockerad."
    echo "   Använd en Pull Request istället."
    echo ""
    exit 1
  fi
done
exit 0
EOF
chmod +x .git/hooks/pre-push
```

---

## .gitignore — Måste innehålla

```
# Environment variables
.env
.env.local
.env.production
.env.development
.env.preview
.env*.local

# Vercel
.vercel

# Dependencies
node_modules/

# OS
.DS_Store
Thumbs.db
```

---

## Checklista — Första setup

```
□ Rename "Smartout.ai"-branch till "main" (GitHub → Settings → Default branch)
□ Skapa "development" från "main"
□ Ta bort gamla oanvända branches
□ Sätt upp branch protection på "main" (med "do not allow bypassing")
□ Verifiera Vercel production branch = main
□ Lägg till alla env vars i Vercel Dashboard med rätt miljö-scope
□ Kör: vercel env pull .env.local (för lokal dev)
□ Skapa .cursor/rules i repot
□ Installera git pre-push hook
□ Verifiera .gitignore innehåller .env*
□ Testkör: försök pusha direkt till main (ska nekas)
□ Testkör: skapa feature-branch → PR till development → PR till main
```

---

## Tre lager av skydd

| Lager                        | Vad det gör                             | Kan kringgås?                          |
| ---------------------------- | --------------------------------------- | -------------------------------------- |
| Git hook (lokalt)            | Stoppar `git push origin main`          | Ja, med `--no-verify`                  |
| Cursor rules                 | AI följer workflow                      | Ja, du kan ignorera det                |
| **GitHub branch protection** | **Blockerar all direkt push till main** | **Nej (med "do not allow bypassing")** |

Det som räknas är lager 3. De andra är bekvämlighets-guardrails.

# Roadmap för Integrering av Organisationsstruktur (Module 2)

> **Draft:** 2026-02-27  
> **Syfte:** Etablera en plan för hur vi kompletterar databasen och bygger in "Organisational Structure" (Locations, Departments, Teams m.fl.) i vårt Dashboard, helt i enlighet med `SMARTOUT_MODULE_2_ORG_STRUCTURE.md` och regelverket i `GEMINI.md`.

---

## 1. Nuläge & Databasuppdateringar

Den grundläggande datamodellen finns redan (`00002_structure_tables.sql`). Men dokumentationen föreskriver features för bl.a. säsonger (`season_aware`) och design-markörer. Därför har en migrationsfil skapats (`00010_org_structure_updates.sql`) som tillför:

- **Zone:** `season_id`, `color`, `sort_order`
- **Asset:** `slug`, `asset_type` (Enum), `icon`, `season_id`, `sort_order`
- **Position:** `season_id`, `color`, `icon`, `sort_order`

### Nästa Steg för Backend:

1. Kör migrationsfilen (`pnpm supabase migration up` eller liknande).
2. Verifiera RLS-policies för nya kolumner och bekräfta att "Admin" kan skriva medan "Users" kan läsa. (RLS är redan applicerat via `00004_rls_policies.sql`, detta faller på befintligt ramverk).

---

## 2. Arkitektur för Dashboard (Hur vi tar ut detta till användaren)

Enligt **ADR-0002 (State-Driven vs Hooks)** kommer state och business logic förbli i databasen/Edge Functions. Dashboard-komponenterna ska fungera som renderare/dispatchers.

### Arbetsflöden att implementera i Dashboard:

**A. Workspace Settings (Admin/Ägare)**

- **Locations & Zones:**
  - Layout för att lägga till nya fysiska platser (Locations).
  - Skapa UI för att binda Zoner och Assets till specifika platser. Drag-and-drop-gränssnitt för att sätta `sort_order`.
- **Departments & Positions:**
  - Kort-baserad (Card) UI för att lista "Kitchen", "Service", o.s.v.
  - Inne i ett Department-kort listar vi Positions. Inkludera en färg-väljare (color picker) för att märka upp en `Position` för schemat (Scheduling Grid).
- **Teams (Dynamiska grupper):**
  - Möjliggöra koppling av anställda mellan olika avdelningar (Cross-departmental teams).
  - Säsongskopplade team (ex: Sommarpersonalen 2026).

### Komponent-struktur:

- Skapa mappen `apps/web/src/components/dashboard/org-structure/`
- Tillhörande komponenter: `LocationManager`, `DepartmentManager`, `TeamManager`.

---

## 3. Road-map (Metodik & Genomförande)

### Fas 1: Fundamentet (Databas & Endpoints) - _Snart klart_

1. Applicera databasändringarna via migration `00010`.
2. Skapa Zod-typer (Schema validation) för de uppdaterade entiteterna under `packages/types/src/org-structure.ts`.
3. Skapa custom hooks (ex. `useDepartments`, `useLocations`) inom Dashboard.

### Fas 2: Gränssnitt för Konfiguration (Dashboard Settings)

1. Bygg färdigt sektionen `Settings -> Organization` i Dashboardet.
2. Implementera **DepartmentManager** där Admin kan skapa avdelningar och lägga till Roller/Positions.
3. Implementera **LocationManager** för Platser, Zoner och Fysiska Tillgångar (Assets). Markera vilka Assets som har `requires_training` = true.
4. Använd moderna, levande komponenter — glassmorphism-effekter och micro-animations vid val av ikoner/färger.

### Fas 3: Koppla på Datat till Resterande Moduler

1. **Scheduling (Schema):** Låt kalender/schema-modulen hämta `Positions` och `Zones` för att rendera rader i schemat.
2. **Onboarding:** Integrera "Team" och "Department"-selection i de sista stegen av anställningsrutinen (så anställda hamnar rätt direkt).
3. **Training & HACCP:** Synliggör Asset-utbildningar för specifika Profiles.

---

## 4. Riktlinjer under byggnation

- **Single Source of Truth:** Alla SQL-frågor måste wrappas i tydliga interfaces (TypeScript). Inget får skapas on-the-fly (`any` är strikt förbjudet).
- **Audit Trails:** Alla redigeringar av en Location eller Department som påverkar aktiva tjänster ska trigga en systemlogg.
- **Premium UX:** Gränssnittet för att styra organisationen ska kännas smidigt. Vi bygger interaktioner utan "hårda" page reloads; optimistic UI är A och O vid förändringar av `sort_order`.

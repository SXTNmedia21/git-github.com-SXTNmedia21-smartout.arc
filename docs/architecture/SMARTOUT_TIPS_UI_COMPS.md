# COMPONENTS.md — Tips Module Component Register

> **Status:** Implementeringsklar spesifikasjon
> **Mål:** Hver skjerm og komponent listet med ansvar, props/state, og hvor den lever
> **Convention:** Path er relativ til `apps/web/`. Filnavn følger eksisterende Smartout v3-mønster.

---

## 1. Screens

### 1.1 Pool Review

> **Hovedskjermen for tips-modulen.** Brukes hver kveld.

| Felt           | Verdi                                                              |
|----------------|--------------------------------------------------------------------|
| Path           | `app/(app)/tips/pools/[poolId]/page.tsx`                           |
| Bruker         | Daglig leder                                                       |
| Hovedoppgave   | Se fordeling, juster ved behov, godkjenn                           |
| API            | `GET /api/tips/pools/[id]`, `PATCH /distributions/[id]`, `POST /pools/[id]/approve` |
| Komponenter    | `PoolHeader`, `DistributionTable`, `AdjustmentDialog`, `ApproveBar` |

### 1.2 Policy Settings

| Felt           | Verdi                                                              |
|----------------|--------------------------------------------------------------------|
| Path           | `app/(app)/tips/policies/page.tsx`                                 |
| Bruker         | Daglig leder                                                       |
| Hovedoppgave   | Sett aktiv policy + rolle-vekter for avdeling                      |
| API            | `GET /api/tips/policies`, `POST /api/tips/policies`                |
| Komponenter    | `PolicyMethodPicker`, `RoleWeightEditor`, `PolicyHistoryList`      |

### 1.3 Min Tips (ansatt)

| Felt           | Verdi                                                              |
|----------------|--------------------------------------------------------------------|
| Path           | `app/(app)/tips/me/page.tsx`                                       |
| Bruker         | Ansatt                                                             |
| Hovedoppgave   | Se egne tips per dag og lønnsperiode                               |
| API            | `GET /api/tips/me?from=&to=`                                       |
| Komponenter    | `MyTipsSummary`, `MyTipsTable`                                     |

### 1.4 Avstemming-integrasjon

> **Ikke en ny skjerm.** Et nytt felt legges inn i eksisterende avstemmingsskjerm.

| Felt           | Verdi                                                              |
|----------------|--------------------------------------------------------------------|
| Path           | Eksisterende avstemmingsskjerm — utvides                           |
| Bruker         | Daglig leder                                                       |
| Hovedoppgave   | Registrer dagens tips-beløp som del av kasseoppgjør                |
| API            | `POST /api/tips/pools`                                             |
| Komponent lagt til | `TipsAmountField`                                              |

---

## 2. Components

### 2.1 `TipsAmountField`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/TipsAmountField.tsx`                               |
| Brukes på     | Avstemmingsskjerm                                                   |
| Ansvar        | Inputfelt for tips-beløp + knapp «Beregn fordeling» som oppretter pool |
| Props         | `departmentId: string`, `poolDate: string`, `onPoolCreated(poolId)` |
| State         | `amount: number`, `submitting: boolean`                             |
| Validering    | Beløp ≥ 0, decimal med to siffer                                    |

### 2.2 `PoolHeader`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/PoolHeader.tsx`                                    |
| Brukes på     | Pool Review                                                         |
| Ansvar        | Vise dato, avdeling, totalbeløp, status, hvem registrerte           |
| Props         | `pool: TipPool`                                                     |
| State         | Ingen                                                               |

### 2.3 `DistributionTable`

> **Hjertet av Pool Review.** Viser hvem som får hva, og hvorfor.

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/DistributionTable.tsx`                             |
| Brukes på     | Pool Review                                                         |
| Ansvar        | Tabell: navn, rolle, timer, vekt, beregnet beløp, justert beløp     |
| Props         | `distributions: Distribution[]`, `editable: boolean`, `onEdit(distId)` |
| State         | Sortering                                                           |
| Detalj        | Rader med `adjusted_amount` markeres visuelt + viser tooltip med årsak |

### 2.4 `AdjustmentDialog`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/AdjustmentDialog.tsx`                              |
| Brukes på     | Pool Review (modal)                                                 |
| Ansvar        | Justere enkelt beløp + skrive påkrevd årsak                         |
| Props         | `distribution: Distribution`, `onSave(amount, reason)`, `onClose()` |
| State         | `newAmount`, `reason`, `saving`                                     |
| Validering    | Beløp ≥ 0, årsak ≥ 5 tegn                                           |

### 2.5 `ApproveBar`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/ApproveBar.tsx`                                    |
| Brukes på     | Pool Review (sticky bunn)                                           |
| Ansvar        | Vise sum vs. pool, varsle hvis avvik, godkjenn-knapp                |
| Props         | `poolAmount: number`, `distributedSum: number`, `onApprove()`       |
| Logikk        | Disable godkjenn hvis sum ≠ pool. Vis differanse rødt.              |

### 2.6 `PolicyMethodPicker`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/PolicyMethodPicker.tsx`                            |
| Brukes på     | Policy Settings                                                     |
| Ansvar        | Velg `flat` / `hours` / `weighted_hours` med kort forklaring per valg |
| Props         | `value`, `onChange(method)`                                         |
| Format        | Radioknapper med eksempel under hvert alternativ                    |

### 2.7 `RoleWeightEditor`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/RoleWeightEditor.tsx`                              |
| Brukes på     | Policy Settings (kun synlig når metode = `weighted_hours`)          |
| Ansvar        | Liste roller med vekt-input per rolle                               |
| Props         | `roles: string[]`, `weights: Record<string, number>`, `onChange(weights)` |
| Defaults      | Servitør 1.0, Bartender 0.9, Runner 0.7, Kjøkken 0.5                |
| Validering    | Vekt ≥ 0, max 2 desimaler                                           |

### 2.8 `PolicyHistoryList`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/PolicyHistoryList.tsx`                             |
| Brukes på     | Policy Settings                                                     |
| Ansvar        | Vise tidligere policies med periode (active_from/to)                |
| Props         | `policies: Policy[]`                                                |
| Format        | Read-only liste, viser hvem som opprettet og når                    |

### 2.9 `MyTipsSummary`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/MyTipsSummary.tsx`                                 |
| Brukes på     | Min Tips                                                            |
| Ansvar        | Topp-kort: «Tips inneværende lønnsperiode», «Sist utbetalt»         |
| Props         | `summary: { currentPeriod: number; lastPaid: number; lastPaidDate?: string }` |

### 2.10 `MyTipsTable`

| Felt          | Verdi                                                               |
|---------------|---------------------------------------------------------------------|
| Path          | `components/tips/MyTipsTable.tsx`                                   |
| Brukes på     | Min Tips                                                            |
| Ansvar        | Liste over distributions med dato, avdeling, beløp, status          |
| Props         | `entries: MyTipEntry[]`                                             |
| Mobil         | Stack-layout under sm-breakpoint (anneMa)                           |

---

## 3. Hooks (TanStack Query)

| Hook                          | Path                       | Endpoint                          |
|-------------------------------|----------------------------|-----------------------------------|
| `usePool(poolId)`             | `lib/tips/queries.ts`      | `GET /api/tips/pools/[id]`        |
| `useCreatePool()`             | `lib/tips/queries.ts`      | `POST /api/tips/pools`            |
| `useApprovePool()`            | `lib/tips/queries.ts`      | `POST /api/tips/pools/[id]/approve` |
| `useUpdateDistribution()`     | `lib/tips/queries.ts`      | `PATCH /api/tips/distributions/[id]` |
| `usePolicies(departmentId)`   | `lib/tips/queries.ts`      | `GET /api/tips/policies`          |
| `useCreatePolicy()`           | `lib/tips/queries.ts`      | `POST /api/tips/policies`         |
| `useMyTips(from, to)`         | `lib/tips/queries.ts`      | `GET /api/tips/me`                |

---

## 4. Pure Logic

| Modul                         | Path                       | Ansvar                                 |
|-------------------------------|----------------------------|----------------------------------------|
| `calculate`                   | `lib/tips/calculate.ts`    | Distribusjons-engine, ren funksjon     |
| `policySchema`                | `lib/tips/types.ts`        | Zod-skjema for Policy                  |
| `poolSchema`                  | `lib/tips/types.ts`        | Zod-skjema for Pool input              |
| `distributionSchema`          | `lib/tips/types.ts`        | Zod-skjema for Distribution patch      |

---

## 5. Komponentavhengigheter

```
Avstemming (eksisterende)
  └── TipsAmountField ──▶ POST /pools ──▶ Pool Review

Pool Review
  ├── PoolHeader
  ├── DistributionTable
  │   └── AdjustmentDialog (modal)
  └── ApproveBar

Policy Settings
  ├── PolicyMethodPicker
  ├── RoleWeightEditor (kun hvis weighted_hours)
  └── PolicyHistoryList

Min Tips
  ├── MyTipsSummary
  └── MyTipsTable
```

---

## 6. Hva som IKKE er en komponent

For å holde scope minimal, følgende trenger IKKE egne komponenter — gjenbruk eksisterende Smartout v3 UI-bibliotek:

- Knapper, inputs, dialog-shells (eksisterende `ui/`-komponenter)
- Layout-shell (sidebar, topbar — fra eksisterende app-shell)
- Toast-meldinger (eksisterende toast-system)
- Auth/role-guards (eksisterende `<RequireRole>`)

---

## 7. Komponent-implementeringsrekkefølge

| Fase | Komponenter                                              |
|------|----------------------------------------------------------|
| 1    | `calculate.ts` + tester (ingen UI)                       |
| 2    | `DistributionTable`, `PoolHeader`, `ApproveBar` → Pool Review skjerm |
| 3    | `AdjustmentDialog`                                       |
| 4    | `TipsAmountField` → integrer med Avstemming              |
| 5    | `PolicyMethodPicker`, `RoleWeightEditor`, `PolicyHistoryList` → Policy skjerm |
| 6    | `MyTipsSummary`, `MyTipsTable` → Min Tips skjerm         |

Hver fase = en Story i Linear under tilhørende Sub-Epic.
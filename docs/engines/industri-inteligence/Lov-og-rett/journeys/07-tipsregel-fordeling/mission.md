---
journey: 07
title: "Tipsregel-fordeling"
trigger: "Workspace setter opp tipsregel, eller månedlig tips-fordeling kjøres"
mode: setup + commit
adr: 0234, 0249
---

# Mission — Tipsregel-fordeling

**Mål:** Sikre lovlig + rettferdig tipsfordeling iht. lov + skattetrekkforskrift.

**Hvorfor:** Tips er **lønnspliktig** siden 2019 (Skatteetaten). Feil håndtering = etterbetaling skatt + AGA. Urettferdig fordeling = arbeidsmiljø-konflikt.

**Trigger:** Workspace-setup (initial), månedlig tips-payout, ad-hoc admin endring av regel.

**Output:**
- Validert tipsregel (`contract_tip_rule`)
- Fordelings-metode dokumentert
- Skatt-info: tips er lønnspliktig fra første krone
- A-melding-kode 22 (tips)

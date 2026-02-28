# Cross-Cutting: Legal, GDPR & Compliance

> **Smartout.io** — Cross-cutting documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Sections 21, 25
> **Scope:** GDPR/Personvern, Norwegian labor law, food safety, accounting law, equality law

---

> This document groups all legal and compliance concerns. Content is extracted from Complete Documentation sections 21 (GDPR) and 25 (Norwegian Legal Compliance).

## 1. GDPR & Privacy Compliance (Section 21)

### 1.1 Data Classification

| Category           | Examples                            | Sensitivity        |
| ------------------ | ----------------------------------- | ------------------ |
| Identity data      | Name, email, phone, date of birth   | Personal           |
| Employment data    | Role, department, salary, contract  | Personal/Sensitive |
| Location data      | GPS punch-in coordinates            | Personal           |
| Health data        | Sick leave records, certifications  | Special category   |
| Communication data | Chat messages, AI conversations     | Personal           |
| Behavioral data    | Task completion, AI context indices | Personal           |
| Financial data     | Salary, bank details, tax info      | Sensitive          |

### 1.2 Legal Basis for Processing

| Processing Activity   | Legal Basis (GDPR Art. 6)                                  |
| --------------------- | ---------------------------------------------------------- |
| Employment management | Contractual necessity (6.1.b)                              |
| Payroll calculation   | Legal obligation (6.1.c)                                   |
| Scheduling & shifts   | Legitimate interest (6.1.f)                                |
| HACCP compliance      | Legal obligation (6.1.c)                                   |
| Training & readiness  | Legitimate interest (6.1.f)                                |
| AI context/sentiment  | Consent (6.1.a) — must be explicit                         |
| GPS punch-in          | Consent (6.1.a) OR legitimate interest with balancing test |
| Communication/chat    | Legitimate interest (6.1.f)                                |
| Gamification/points   | Consent (6.1.a)                                            |

### 1.3 Data Processor Agreements (DPA)

Smartout = Data Processor. Employer = Data Controller.

| Sub-processor       | Purpose                 | Data                           |
| ------------------- | ----------------------- | ------------------------------ |
| Supabase            | Backend, database, auth | All platform data              |
| Vercel              | Web hosting             | Request logs, session data     |
| Twilio              | SMS, voice              | Phone numbers, message content |
| Resend              | Email                   | Email addresses, content       |
| Stripe              | Billing                 | Company billing info           |
| DigitalOcean        | n8n hosting             | Workflow execution data        |
| Ultravox (Fixie.ai) | Voice AI                | Voice recordings, transcripts  |

### 1.4 Consent Management

- Explicit opt-in for: AI sentiment tracking, GPS location, gamification, voice recordings
- Granular consent per feature, revocable at any time
- Consent records stored with timestamp and version

### 1.5 Data Subject Rights

| Right                         | Implementation                                 |
| ----------------------------- | ---------------------------------------------- |
| Access (Art. 15)              | Self-service data export from Profile settings |
| Portability (Art. 20)         | JSON/CSV export of all personal data           |
| Erasure (Art. 17)             | Account deletion with cascading data removal   |
| Rectification (Art. 16)       | Profile editing + support request              |
| Restrict processing (Art. 18) | Status: inactive + processing flags            |
| Object (Art. 21)              | Opt-out toggles per processing activity        |
| Automated decisions (Art. 22) | AI suggestions always reviewable by humans     |

### 1.6 Data Erasure Implementation

1. Profile deactivated → offboarding status
2. Personal data anonymized (name → "Deleted User #xxx")
3. Employment records retained (Bokføringsloven: 5 years)
4. Chat messages: author anonymized, content retained if needed
5. AI context data: fully deleted
6. Payroll records: anonymized but financial data retained
7. Audit log entry created

### 1.7 Retention Policies

| Data Type            | Retention                     | Legal Basis         |
| -------------------- | ----------------------------- | ------------------- |
| Employment records   | 5 years after employment ends | Bokføringsloven     |
| Payroll/tax records  | 5 years                       | Bokføringsloven     |
| HACCP logs           | 5 years                       | Mattilsynet         |
| Chat messages        | 1 year (configurable)         | Legitimate interest |
| AI conversation logs | 90 days                       | Consent             |
| GPS punch data       | 90 days after pay period      | Purpose limitation  |
| Training completion  | Employment + 2 years          | Legitimate interest |
| Audit logs           | 7 years                       | Security/compliance |

### 1.8 Privacy by Design

- RLS enforces workspace isolation at database level
- Trainee sandbox prevents accidental data exposure
- AI context indices are aggregate scores, not raw PII
- No PII in logs or error messages
- Encrypted at rest and in transit

### 1.9 Data Breach Procedures

- Detection → Assessment within 24h → Datatilsynet within 72h if risk → Individual notification if high risk → Documentation → Remediation

### 1.10 Privacy Statement

Published at smartout.io/privacy. Norwegian language. Version-controlled.

---

## 2. Norwegian Legal Compliance (Section 25)

### 2.1 Arbeidsmiljøloven (Working Environment Act)

| Requirement                           | Smartout Implementation                    |
| ------------------------------------- | ------------------------------------------ |
| Written employment contract (§14-5/6) | Contract management module                 |
| Working time limits (§10)             | Scheduling: automatic overtime detection   |
| Overtime rules (§10-6)                | Payroll: 40%/50% supplement calculation    |
| Young workers (§11)                   | Profile: date_of_birth for age-based rules |
| Trial period (§15-6)                  | Contract: trial_period_end field           |
| Notice period (§15-3)                 | Contract: notice_period_days               |
| Vacation (Ferieloven)                 | Absence: 25 days statutory minimum         |
| Sick leave (Folketrygdloven)          | Absence: employer period (16 days) + NAV   |
| Parental leave (§12-5)                | Absence: leave type tracking               |
| Emergency contact                     | Profile: emergency_contact fields          |

### 2.2 Skatteloven & A-melding

Monthly reporting to Skatteetaten: employee income, tax withholding, employer social security (14.1%), pension (OTP 2%), employment dates. Export function generates required format.

### 2.3 Mattilsynet / HACCP

Implemented via Module 5: temperature logging, hygiene documentation, CCP monitoring, deviation reporting, inspection-ready reports.

### 2.4 Bokføringsloven (Bookkeeping Act)

Financial record retention: 5 years minimum. Anonymization after retention while maintaining financial records.

### 2.5 Likestillings- og diskrimineringsloven (Equality Act)

No discriminatory features. Scheduling algorithms don't discriminate on protected characteristics.

---

_This document consolidates all legal and compliance requirements. Individual modules reference these requirements in their integration points._

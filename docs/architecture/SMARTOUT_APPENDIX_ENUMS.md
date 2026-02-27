# Smartout — All Enums (Option Sets)

> **Smartout.io** — Appendix
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Appendix B

---

```typescript
// Profile & Identity
type ProfileRole = 'employee' | 'manager' | 'admin' | 'owner'
type ProfileStatus = 'trainee' | 'active' | 'inactive' | 'offboarding'
type CompanyMemberRole = 'owner' | 'admin' | 'member'
type AuthProvider = 'supabase' | 'google' | 'microsoft'
type Language = 'no' | 'sv' | 'en' | 'da' | 'fi'
type Country = 'NO' | 'SE' | 'DK' | 'FI'
type Currency = 'NOK' | 'SEK' | 'DKK' | 'EUR'
type Industry = 'restaurant' | 'hotel' | 'cafe' | 'bar' | 'catering' | 'other'

// Organization
type LocationType = 'main' | 'outdoor' | 'kitchen' | 'event' | 'storage' | 'other'
type TeamType = 'operational' | 'access' | 'cross_department' | 'seasonal' | 'custom'
type AssetType = 'equipment' | 'checkpoint' | 'ccp' | 'furniture' | 'vehicle' | 'other'

// Governance
type PolicyType = 'payroll' | 'scheduling' | 'operations' | 'training' | 'tasks' | 'qa' | 'safety' | 'general'
type PolicyScope = 'workspace' | 'department' | 'team' | 'location'
type EnforcementStatus = 'aspirational' | 'enforced'
type ProtocolStatus = 'draft' | 'active' | 'deprecated'
type ProcedureType = 'standard' | 'onboarding' | 'safety' | 'maintenance' | 'custom'
type RoutineTrigger = 'scheduled' | 'event'
type ControlFrequency = 'every_time' | 'every_nth' | 'never'

// Season & Time
type SeasonType = 'default' | 'calendar' | 'focus' | 'cycle' | 'custom'
type SeasonStatus = 'draft' | 'active' | 'archived'

// Operations
type SessionStatus = 'upcoming' | 'active' | 'pending_signoff' | 'closed' | 'missed'
type TaskStatus = 'pending' | 'available' | 'in_progress' | 'completed' | 'skipped' | 'overdue' | 'escalated'
type HookType = 'pre_open' | 'open' | 'scheduled' | 'pre_close' | 'close' | 'custom'

// Scheduling & HR
type DayCategory = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'weekend'
type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'
type EmploymentCategory = 'full_time' | 'part_time' | 'temporary' | 'flexible' | 'apprentice'
type ContractType = 'permanent' | 'temporary' | 'freelance' | 'apprentice' | 'substitute'
type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'amended' | 'terminated' | 'expired'

// Payroll
type RateType = 'fixed' | 'hourly' | 'multiplier' | 'percentage' | 'calculated'
type SalaryCategory = 'base_pay' | 'overtime' | 'supplement' | 'absence' | 'deductions'
type SalaryType = 'hourly' | 'monthly'

// Absence
type AbsenceType = 'sick_leave' | 'parental_leave' | 'vacation' | 'unpaid_leave' | 'military' | 'training' | 'welfare'
type RequestType = 'available' | 'not_available' | 'vacation' | 'sick_day' | 'flextime' | 'shift_swap' | 'other'

// Communication
type NotificationChannel = 'push' | 'sms' | 'email' | 'voice' | 'in_app'

// Billing
type SubscriptionStatus = 'trial' | 'active' | 'paused' | 'past_due' | 'cancelled' | 'unpaid'

// Certifications
type CertificationType = 'food_safety' | 'first_aid' | 'alcohol_service' | 'hygiene' | 'fire_safety' | 'allergen' | 'custom'
type CertificationStatus = 'valid' | 'expiring_soon' | 'expired' | 'revoked'

// AI
type AIAuthorityLevel = 'autonomous' | 'notify_suggest' | 'notify' | 'escalate' | 'never'
```

---

*These enums are implemented as TypeScript union types in `packages/types/src/enums.ts`. Never use TypeScript `enum` — use union types.*

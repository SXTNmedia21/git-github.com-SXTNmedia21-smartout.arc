import { BillingTabs } from "./_components/billing-tabs";

// Billing hub layout. Preserves existing MRR dashboard (page.tsx) as the
// Oversikt tab. Added in Phase 6.1 of Billing Engine Fase 1.

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">Fakturering</h1>
      </div>
      <BillingTabs />
      {children}
    </div>
  );
}

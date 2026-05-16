"use client";

import { useState } from "react";
import { SettingsTabs, type TabId } from "./_components/settings-tabs";
import { SettingsToolsBridge } from "./_tools/settings-tools-bridge";
import { usePayrollSettings } from "./_hooks/use-payroll-settings";
import { useWorkspaceOperatingHours } from "./_hooks/use-workspace-operating-hours";
import { useTranslation } from "@smartout/i18n";

export default function SettingsPage() {
  const { t } = useTranslation("dashboard");

  // Lifted state: owned here so SettingsToolsBridge can read + set the active tab.
  const [activeTab, setActiveTab] = useState<TabId>("hours");

  // Background reads for tool summaries — TanStack deduplicates if child hooks
  // also call these. Lazy-loaded panels won't have fired yet on first mount.
  const { data: payrollRaw } = usePayrollSettings();
  const { hours: operatingHoursRaw } = useWorkspaceOperatingHours();

  const payrollSettings = payrollRaw
    ? {
        period_type: payrollRaw.period_type ?? null,
        is_tariff_bound: payrollRaw.is_tariff_bound ?? null,
        supplement_stacking_policy: payrollRaw.supplement_stacking_policy ?? null,
        overtime_requires_pre_approval: payrollRaw.overtime_requires_pre_approval ?? null,
        shift_grouping: payrollRaw.shift_grouping ?? null,
      }
    : null;

  const operatingHours = operatingHoursRaw.length > 0 ? operatingHoursRaw : null;

  return (
    <>
      <div className="mb-6">
        <h1 className="font-heading text-foreground mb-2 text-3xl font-extrabold tracking-tight">
          {t("settings_page.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("settings_page.description")}</p>
      </div>

      <SettingsToolsBridge
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        payrollSettings={payrollSettings}
        operatingHours={operatingHours}
      />

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}

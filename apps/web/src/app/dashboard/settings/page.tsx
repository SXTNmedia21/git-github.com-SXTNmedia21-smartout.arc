"use client";

import { SettingsTabs } from "./_components/settings-tabs";
import { useTranslation } from "@smartout/i18n";

export default function SettingsPage() {
  const { t } = useTranslation("dashboard");

  return (
    <>
      <div className="mb-6">
        <h1 className="font-heading text-foreground mb-2 text-3xl font-extrabold tracking-tight">
          {t("settings_page.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("settings_page.description")}</p>
      </div>

      <SettingsTabs />
    </>
  );
}

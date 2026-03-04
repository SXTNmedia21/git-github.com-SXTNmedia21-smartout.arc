import { SettingsTabs } from "./_components/settings-tabs";

export default function SettingsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-foreground mb-2 text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure your workspace settings and preferences.
        </p>
      </div>

      <SettingsTabs />
    </>
  );
}

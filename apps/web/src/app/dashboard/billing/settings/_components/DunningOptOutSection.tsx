"use client";

import { useTranslation } from "@smartout/i18n";
import type { BillingDispatchRule } from "@smartout/billing";

import { DunningOptOutToggle } from "./DunningOptOutToggle";

// DunningOptOutSection — "Automatiske påminnelser" section on
// /dashboard/billing/settings. Renders one toggle per workspace the
// caller administers. The parent Server Component loads the suppress
// rules (if any) and passes them indexed by workspace_id.

type Props = {
  workspaces: Array<{ workspace_id: string; name: string }>;
  /** Suppress rules indexed by workspace_id. Missing key = no rule. */
  suppressRulesByWorkspace: Record<string, BillingDispatchRule | null>;
};

export function DunningOptOutSection({ workspaces, suppressRulesByWorkspace }: Props) {
  const { t } = useTranslation("billing");
  const showPerWorkspaceHeading = workspaces.length > 1;

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="font-heading text-lg">{t("dunning.optout.section_title")}</h2>
        <p className="text-muted-foreground max-w-prose text-xs">
          {t("dunning.optout.section_description")}
        </p>
      </header>

      <div className="space-y-3">
        {workspaces.map((ws) => (
          <DunningOptOutToggle
            key={ws.workspace_id}
            workspaceId={ws.workspace_id}
            workspaceName={ws.name}
            existingSuppressRule={suppressRulesByWorkspace[ws.workspace_id] ?? null}
            showWorkspaceHeading={showPerWorkspaceHeading}
          />
        ))}
      </div>
    </section>
  );
}

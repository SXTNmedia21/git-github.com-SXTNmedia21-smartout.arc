import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

type ReusableComponent = {
  path: string;
  name: string;
  description: string;
};

const MODULE_TO_DIRS: Record<string, string[]> = {
  scheduling: ["schedule/_components", "schedule/_hooks"],
  operations: ["close/_components", "close/_hooks", "reconciliation/"],
  training: ["governance/", "my-training/"],
  org: ["organization/"],
  communication: ["chat/"],
  all: ["_components/", "_hooks/", "../../components/dashboard/", "../../components/ui/"],
};

const SHARED: ReusableComponent[] = [
  {
    path: "components/dashboard/SignalCard.tsx",
    name: "SignalCard",
    description: "Metric card with good/warning/critical status",
  },
  {
    path: "components/dashboard/DashboardCard.tsx",
    name: "DashboardCard",
    description: "Standard card wrapper for dashboard content",
  },
  {
    path: "components/dashboard/DashboardShell.tsx",
    name: "DashboardShell",
    description: "Main dashboard layout with sidebar and context",
  },
  {
    path: "components/dashboard/EmployeeDashboard.tsx",
    name: "EmployeeDashboard",
    description: "Employee landing page with shifts and readiness",
  },
  {
    path: "components/platform-admin/data-table.tsx",
    name: "DataTable",
    description: "TanStack Table with sorting, filtering, pagination",
  },
  {
    path: "components/platform-admin/confirmation-dialog.tsx",
    name: "ConfirmationDialog",
    description: "Type-to-confirm destructive action dialog",
  },
  {
    path: "components/platform-admin/status-badge.tsx",
    name: "StatusBadge",
    description: "Colored status indicator badge",
  },
  {
    path: "components/dashboard/ActionStrip.tsx",
    name: "ActionStrip",
    description: "Quick-action buttons strip below header",
  },
  {
    path: "components/dashboard/GlobalSearchPalette.tsx",
    name: "GlobalSearchPalette",
    description: "Cmd+K search palette",
  },
  {
    path: "components/dashboard/SeasonCard.tsx",
    name: "SeasonCard",
    description: "Active season display card",
  },
  {
    path: "components/contract-editor/contract-editor.tsx",
    name: "ContractEditor",
    description: "Tiptap-based rich text editor",
  },
];

export function findReusableComponents(module: string): ReusableComponent[] {
  const dirs = [...(MODULE_TO_DIRS[module] ?? []), ...MODULE_TO_DIRS.all];
  const components: ReusableComponent[] = [...SHARED];

  for (const dir of dirs) {
    const basePath = `apps/web/src/app/dashboard/${dir}`;
    try {
      const files = execSync(`find ${basePath} -name "use-*.ts" -o -name "use-*.tsx" 2>/dev/null`, {
        encoding: "utf-8",
      });
      for (const file of files.trim().split("\n").filter(Boolean)) {
        const name =
          file
            .split("/")
            .pop()
            ?.replace(/\.(ts|tsx)$/, "") ?? "";
        const content = readFileSync(file, "utf-8").slice(0, 200);
        const desc = content.match(/\/\*\*\s*\n\s*\*\s*(.+)/)?.[1] ?? `Hook: ${name}`;
        components.push({
          path: file.replace("apps/web/src/", ""),
          name,
          description: desc,
        });
      }
    } catch {
      // Directory doesn't exist — skip
    }
  }

  return components;
}

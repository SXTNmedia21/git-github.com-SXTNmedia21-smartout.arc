import { z } from "zod";

export const createContractSchema = z.object({
  template_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  contract_type: z
    .enum(["client", "employee", "haccp", "training", "season", "custom"])
    .default("client"),
  recipient_name: z.string().min(1),
  recipient_email: z.string().email(),
  journey_type: z.enum(["self_service", "sales_assisted"]).default("sales_assisted"),
  auto_create_workspace: z.boolean().default(false),
  value_overrides: z.record(z.string()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export const listContractsQuery = z.object({
  workspace_id: z.string().uuid().optional(),
  status: z.string().optional(),
  contract_type: z.string().optional(),
  recipient_email: z.string().optional(),
});

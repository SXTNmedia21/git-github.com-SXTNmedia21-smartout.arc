/**
 * Contract dashboard filter bucketing.
 *
 * Groups employment contract statuses into 3 dashboard buckets:
 * - waiting_employee: contracts awaiting action from the employee
 * - ready_for_action: contracts the admin can act on now
 * - completed: contracts that have reached a terminal state
 */

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "expired"
  | "pending_data"
  | "declined"
  | "cancelled";

export type DashboardBucket = "waiting_employee" | "ready_for_action" | "completed";

/**
 * Map a single contract status to its dashboard bucket.
 *
 * - sent / viewed / pending_data → employee must act
 * - draft / declined / expired → admin should take action
 * - signed / cancelled → terminal, nothing to do
 */
export function getContractBucket(status: ContractStatus): DashboardBucket {
  switch (status) {
    case "sent":
    case "viewed":
    case "pending_data":
      return "waiting_employee";
    case "draft":
    case "declined":
    case "expired":
      return "ready_for_action";
    case "signed":
    case "cancelled":
      return "completed";
    default:
      return "ready_for_action";
  }
}

/**
 * Group an array of contracts by dashboard bucket.
 *
 * Returns a record with all three buckets (empty arrays for buckets with no contracts).
 */
export function groupByBucket<T extends { status: ContractStatus }>(
  contracts: T[],
): Record<DashboardBucket, T[]> {
  const result: Record<DashboardBucket, T[]> = {
    waiting_employee: [],
    ready_for_action: [],
    completed: [],
  };

  for (const contract of contracts) {
    const bucket = getContractBucket(contract.status);
    result[bucket].push(contract);
  }

  return result;
}

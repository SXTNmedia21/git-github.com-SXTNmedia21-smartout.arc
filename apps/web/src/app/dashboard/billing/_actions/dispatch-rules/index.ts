// Workspace-admin dispatch rule Server Action barrel. Scope-gated:
// caller must be company admin/owner AND the targeted rule must live
// in one of the caller's workspace_ids. Platform rules (workspace_id
// NULL) are never touchable from this surface.

export { createDispatchRuleAction } from "./createDispatchRuleAction";
export { updateDispatchRuleAction } from "./updateDispatchRuleAction";
export { deleteDispatchRuleAction } from "./deleteDispatchRuleAction";
export { toggleDispatchRuleAction } from "./toggleDispatchRuleAction";

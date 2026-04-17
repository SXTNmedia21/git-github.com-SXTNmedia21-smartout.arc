// Barrel for platform-admin integration Server Actions.
// Consumers (the _components directory) import from this barrel to
// avoid deep path churn during Fase 3 refactors.

export { createIntegrationAction } from "./createIntegrationAction";
export { updateIntegrationAction } from "./updateIntegrationAction";
export { deleteIntegrationAction } from "./deleteIntegrationAction";
export { toggleIntegrationAction } from "./toggleIntegrationAction";
export { testConnectionActionServer } from "./testConnectionActionServer";
export { retriggerIntegrationSyncAction } from "./retriggerIntegrationSyncAction";
export { loadIntegrationSyncHistory } from "./loadIntegrationSyncHistory";

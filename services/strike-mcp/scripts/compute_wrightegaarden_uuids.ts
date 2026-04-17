#!/usr/bin/env tsx
import { strikeUuid } from "../src/migration/uuid.js";

const bubbleCompanyId = "1683059156184x868193356345167900";
const bubbleWorkspaceId = "1683059156689x546199168715701950";

console.log("Wrightegaarden company_id:  ", strikeUuid("company", bubbleCompanyId));
console.log("Wrightegaarden workspace_id:", strikeUuid("workspace", bubbleWorkspaceId));

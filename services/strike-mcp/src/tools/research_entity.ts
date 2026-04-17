import { join } from "node:path";
import { z } from "zod";
import { getEntityByName, allEntityNames } from "../entities.js";
import type { BubbleRecord } from "../bubble/types.js";
import {
  loadMapping,
  saveMapping,
  type Mapping,
} from "../research/mapping.js";
import { observe } from "../research/observation.js";
import { diff } from "../research/diff.js";
import { propose } from "../research/propose.js";
import { writeNarrative } from "../research/narrative.js";
import type { ToolContext } from "./list_workspaces.js";

const SAMPLE_SIZE = 50;

export interface ResearchEntityResult {
  entity: string;
  bubbleType: string;
  sampleRecordCount: number;
  totalRecordCount: number;
  unreviewedFieldCount: number;
  newFields: string[];
  disappearedFields: string[];
  typeChanges: Array<{ field: string; before: string[]; after: string[] }>;
  mappingPath: string;
  narrativePath: string;
}

function createEmptyMapping(entity: string, bubbleType: string): Mapping {
  return {
    entity,
    bubble_type: bubbleType,
    target_table: null,
    field_map: {},
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "",
    sample_record_count: 0,
    total_record_count: null,
    v3_schema_hash: null,
  };
}

function dedupeById(records: BubbleRecord[]): BubbleRecord[] {
  const seen = new Set<string>();
  const out: BubbleRecord[] = [];
  for (const record of records) {
    if (seen.has(record._id)) continue;
    seen.add(record._id);
    out.push(record);
  }
  return out;
}

export const researchEntityTool = {
  name: "research_entity",
  description:
    "Sample a Bubble entity bidirectionally, observe its field shape, diff against the stored mapping, propose updates, save the mapping, and write a human-readable shape report into the vault.",
  inputSchema: z.object({
    entity: z.string().min(1),
  }),
  execute: async (
    input: { entity: string },
    ctx: ToolContext,
  ): Promise<ResearchEntityResult> => {
    const entry = getEntityByName(input.entity);
    if (!entry) {
      throw new Error(
        `Unknown entity "${input.entity}". Known entities: ${allEntityNames().join(", ")}`,
      );
    }

    const sample = await ctx.bubble.sampleBidirectional(
      entry.bubbleType,
      SAMPLE_SIZE,
    );
    const records = dedupeById([...sample.firstN, ...sample.lastN]);

    const observation = observe(records);

    const existing =
      (await loadMapping(ctx.mappingsDir, entry.name)) ??
      createEmptyMapping(entry.name, entry.bubbleType);

    const diffResult = diff(existing, observation);
    const proposed = propose(existing, observation, records.length);
    proposed.total_record_count = sample.totalCount;

    await saveMapping(ctx.mappingsDir, proposed);
    await writeNarrative(ctx.vaultBubbleShapesDir, proposed, diffResult);

    const unreviewedFieldCount = Object.values(proposed.field_map).filter(
      (f) => f.needs_review,
    ).length;

    return {
      entity: proposed.entity,
      bubbleType: proposed.bubble_type,
      sampleRecordCount: records.length,
      totalRecordCount: sample.totalCount,
      unreviewedFieldCount,
      newFields: diffResult.newFields,
      disappearedFields: diffResult.disappearedFields,
      typeChanges: diffResult.typeChanges,
      mappingPath: join(ctx.mappingsDir, `${proposed.entity}.json`),
      narrativePath: join(ctx.vaultBubbleShapesDir, `${proposed.entity}.md`),
    };
  },
};

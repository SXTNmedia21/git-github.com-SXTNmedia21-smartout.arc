// ============================================
// list-data-sources.ts
// Returns available report data sources and their queryable fields.
// The agent uses this to present options to the user in the
// report creation wizard (step 1: "what do you want to report on?").
// Connected to: packages/ai/src/tools/report/preview-report.ts (executes queries on these sources)
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { ReportToolContext } from "./types";

/**
 * Static catalog of data sources, their human-readable names,
 * available fields, and suggested metrics. This is not queried
 * from the database — it's a curated list matching our schema.
 */
const DATA_SOURCE_CATALOG = [
  {
    id: "profiles",
    table: "profile",
    name: "Medarbeidere (Profiles)",
    description: "Alle ansatte i workspace — status, rolle, avdeling, team",
    fields: [
      { name: "profile_id", type: "uuid", label: "Profil-ID" },
      { name: "display_name", type: "text", label: "Visningsnavn" },
      { name: "email", type: "text", label: "E-post" },
      {
        name: "role",
        type: "enum",
        label: "Rolle",
        values: ["employee", "manager", "admin", "owner"],
      },
      {
        name: "status",
        type: "enum",
        label: "Status",
        values: ["trainee", "active", "inactive", "offboarding"],
      },
      { name: "department_id", type: "uuid", label: "Avdeling" },
      { name: "team_id", type: "uuid", label: "Team" },
      { name: "created_at", type: "timestamp", label: "Opprettet" },
    ],
    suggested_metrics: [
      { field: "*", aggregation: "count", label: "Antall ansatte" },
      { field: "role", aggregation: "count_distinct", label: "Unike roller" },
      { field: "status", aggregation: "count", label: "Per status" },
    ],
    suggested_group_by: ["role", "status", "department_id", "team_id"],
  },
  {
    id: "departments",
    table: "department",
    name: "Avdelinger (Departments)",
    description: "Avdelinger i organisasjonen — permanent struktur",
    fields: [
      { name: "department_id", type: "uuid", label: "Avdeling-ID" },
      { name: "name", type: "text", label: "Navn" },
      { name: "created_at", type: "timestamp", label: "Opprettet" },
    ],
    suggested_metrics: [{ field: "*", aggregation: "count", label: "Antall avdelinger" }],
    suggested_group_by: [],
  },
  {
    id: "teams",
    table: "team",
    name: "Team",
    description: "Team-grupper — kan være sesongbaserte",
    fields: [
      { name: "team_id", type: "uuid", label: "Team-ID" },
      { name: "name", type: "text", label: "Navn" },
      { name: "department_id", type: "uuid", label: "Avdeling" },
      { name: "leader_profile_id", type: "uuid", label: "Teamleder" },
      { name: "created_at", type: "timestamp", label: "Opprettet" },
    ],
    suggested_metrics: [{ field: "*", aggregation: "count", label: "Antall team" }],
    suggested_group_by: ["department_id"],
  },
  {
    id: "locations",
    table: "location",
    name: "Lokasjoner (Locations)",
    description: "Fysiske steder — restauranter, hoteller, etc.",
    fields: [
      { name: "location_id", type: "uuid", label: "Lokasjon-ID" },
      { name: "name", type: "text", label: "Navn" },
      { name: "address", type: "text", label: "Adresse" },
      { name: "created_at", type: "timestamp", label: "Opprettet" },
    ],
    suggested_metrics: [{ field: "*", aggregation: "count", label: "Antall lokasjoner" }],
    suggested_group_by: [],
  },
  {
    id: "protocols",
    table: "protocol",
    name: "Protokoller (Protocols)",
    description: "Opplærings- og kompetansekrav",
    fields: [
      { name: "protocol_id", type: "uuid", label: "Protokoll-ID" },
      { name: "title", type: "text", label: "Tittel" },
      { name: "type", type: "enum", label: "Type" },
      { name: "department_id", type: "uuid", label: "Avdeling" },
      { name: "is_active", type: "boolean", label: "Aktiv" },
      { name: "created_at", type: "timestamp", label: "Opprettet" },
    ],
    suggested_metrics: [
      { field: "*", aggregation: "count", label: "Antall protokoller" },
      { field: "is_active", aggregation: "count", label: "Aktive protokoller" },
    ],
    suggested_group_by: ["type", "department_id", "is_active"],
  },
  {
    id: "protocol_assignments",
    table: "protocol_assignment",
    name: "Protokoll-tildelinger (Assignments)",
    description: "Hvem som er tildelt hvilke protokoller — fullføringsstatus",
    fields: [
      { name: "assignment_id", type: "uuid", label: "Tildeling-ID" },
      { name: "protocol_id", type: "uuid", label: "Protokoll" },
      { name: "profile_id", type: "uuid", label: "Profil" },
      {
        name: "status",
        type: "enum",
        label: "Status",
        values: ["assigned", "in_progress", "completed"],
      },
      { name: "completed_at", type: "timestamp", label: "Fullført" },
      { name: "created_at", type: "timestamp", label: "Tildelt" },
    ],
    suggested_metrics: [
      { field: "*", aggregation: "count", label: "Totalt tildelinger" },
      { field: "status", aggregation: "count", label: "Per status" },
      { field: "completed_at", aggregation: "count", label: "Fullførte" },
    ],
    suggested_group_by: ["status", "protocol_id", "profile_id"],
  },
];

/**
 * list_data_sources — Returns the catalog of available data sources.
 * No parameters needed. Used by the agent to present options
 * in the report wizard.
 */
export const listDataSources = defineTool({
  name: "list_data_sources",
  description:
    "List all available data sources for building reports. Returns source names, descriptions, queryable fields, suggested metrics, and grouping options. Call this first to show the user what they can report on.",
  schema: z.object({}),
  execute: async (_params: Record<string, never>, _ctx: ReportToolContext) => {
    return JSON.stringify({ data_sources: DATA_SOURCE_CATALOG });
  },
});

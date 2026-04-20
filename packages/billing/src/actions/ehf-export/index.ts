// Fase 3B B3 — EHF CSV-eksport pure action.
//
// Pure async-funksjon for platform-admin CSV-eksport av EHF-berettigede
// fakturaer. Web-adapter (B5) wrapper dette i Server Action med Storage-
// upload + signed URL. PDF-halvdelen eies av B4.

export {
  generateEhfExport,
  type GenerateEhfExportArgs,
  type GenerateEhfExportResult,
  type EhfExportArtifact,
} from "./generateEhfExport";

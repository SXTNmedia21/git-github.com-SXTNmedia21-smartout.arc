// Contract template editor AI tools
// Architecture spec Section 5.4: 18 tools total

// Types
export type { EditorAction, ContractEditorState, ContractToolContext } from "./types";

// Document Reading (2)
export { readDocument } from "./read-document";
export { readPlaceholders } from "./read-placeholders";

// Document Editing (5)
export { replaceSection } from "./replace-section";
export { insertSection } from "./insert-section";
export { removeSection } from "./remove-section";
export { editText } from "./edit-text";
export { reorderSections } from "./reorder-sections";

// Design & Styling (3)
export { highlightText } from "./highlight-text";
export { applyDesign } from "./apply-design";
export { addImage } from "./add-image";

// Placeholder & Field Management (2)
export { addPlaceholder } from "./add-placeholder";
export { addSignatureField } from "./add-signature-field";

// Translation (2)
export { translateSection } from "./translate-section";
export { translateDocument } from "./translate-document";

// Preview & Validation (3)
export { validateContract } from "./validate-contract";
export { summarizeContract } from "./summarize-contract";
export { generatePreview } from "./generate-preview";

// Clause Library (1)
export { searchClauses } from "./search-clauses";

// All tools array for agent registration
import { readDocument } from "./read-document";
import { readPlaceholders } from "./read-placeholders";
import { replaceSection } from "./replace-section";
import { insertSection } from "./insert-section";
import { removeSection } from "./remove-section";
import { editText } from "./edit-text";
import { reorderSections } from "./reorder-sections";
import { highlightText } from "./highlight-text";
import { applyDesign } from "./apply-design";
import { addImage } from "./add-image";
import { addPlaceholder } from "./add-placeholder";
import { addSignatureField } from "./add-signature-field";
import { translateSection } from "./translate-section";
import { translateDocument } from "./translate-document";
import { validateContract } from "./validate-contract";
import { summarizeContract } from "./summarize-contract";
import { generatePreview } from "./generate-preview";
import { searchClauses } from "./search-clauses";

/** All 18 contract template editor tools. Pass to toVercelTools() with a ContractToolContext. */
export const CONTRACT_TOOLS = [
  readDocument,
  readPlaceholders,
  replaceSection,
  insertSection,
  removeSection,
  editText,
  reorderSections,
  highlightText,
  applyDesign,
  addImage,
  addPlaceholder,
  addSignatureField,
  translateSection,
  translateDocument,
  validateContract,
  summarizeContract,
  generatePreview,
  searchClauses,
] as const;

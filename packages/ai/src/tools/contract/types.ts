/**
 * EditorAction — Describes a change to be applied to the Tiptap contract editor.
 * Returned by AI tools and processed by the client-side editor.
 */
export type EditorAction = {
  type: string;
  target?: string;
  content?: string;
  data?: Record<string, unknown>;
};

/**
 * ContractEditorState — The current state of the contract editor, provided as context to tools.
 */
export type ContractEditorState = {
  html: string;
  text: string;
};

/**
 * ContractToolContext — Context available to all contract tools.
 */
export type ContractToolContext = {
  editorState: ContractEditorState | null;
  templateId: string;
};

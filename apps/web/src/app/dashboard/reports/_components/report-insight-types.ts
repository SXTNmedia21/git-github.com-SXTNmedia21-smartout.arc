// ============================================
// report-insight-types.ts
// Shared types for report card insight interactions.
// Used by report sections and the insight drawer.
// ============================================

/**
 * Defines one adjustable variable for a report insight card.
 */
export type ReportInsightFactor = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

/**
 * Describes the insight payload shown when a report card is clicked.
 */
export type ReportInsightCard = {
  cardId: string;
  title: string;
  summary: string;
  factors: ReportInsightFactor[];
};

"use client";

/**
 * /dashboard/contracts/new — New contract composition page.
 *
 * Renders the CompositionWizard which guides an admin through
 * cascade-derived contract creation (ADR-0076).
 */

import { CompositionWizard } from "../_components/CompositionWizard";

export default function NewContractPage() {
  return <CompositionWizard />;
}

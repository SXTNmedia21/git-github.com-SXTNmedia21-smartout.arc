/**
 * Bridge between EmploymentStepAdapter (registers save fn)
 * and wizard-definition (calls it in onStepLeave).
 */

let saveFn: (() => Promise<void>) | null = null;

export function registerEmploymentSave(fn: () => Promise<void>) {
  saveFn = fn;
}

export function unregisterEmploymentSave() {
  saveFn = null;
}

export async function callEmploymentSave() {
  await saveFn?.();
}

/**
 * loading.tsx — Suspense fallback for /dashboard/settings/operations.
 *
 * Returns null — the page owns its loading state per SectionCard skeleton
 * pattern. A shared loading.tsx skeleton cannot branch on role or data shape,
 * so we let each card render its own animated pulse (SkeletonLines).
 *
 * See: smartout-page-polish skill — "Skeleton Crossfade Pattern".
 */
export default function SettingsOperationsLoading() {
  return null;
}

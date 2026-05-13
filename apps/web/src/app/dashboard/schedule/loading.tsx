// Skeleton ownership moved to ScheduleLoadingSkeleton in page.tsx.
// AnimatePresence mode="wait" in the client component crossfades the skeleton
// with real content — a shared Suspense fallback here would mount/unmount
// a different tree and cause a blank-frame flash before the client component
// takes over. Returning null avoids that conflict.
// Reference pattern: apps/web/src/components/day/WebDayControl.tsx
export default function ScheduleLoading() {
  return null;
}

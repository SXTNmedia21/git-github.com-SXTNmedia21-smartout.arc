/**
 * loading.tsx — null skeleton for /dashboard/people.
 *
 * Why null: page.tsx is an RSC that fetches all people data server-side
 * before rendering. The "loading" window is the RSC streaming phase, during
 * which no role-specific DOM tree can be rendered correctly (the role is
 * resolved inside the RSC). Returning null lets Next.js show nothing rather
 * than a skeleton that may mismatch role-branching in sub-components.
 *
 * Per smartout-page-polish Phase 2 pattern: "return null from loading.tsx,
 * own the skeleton per view" — avoids wrong-shape flash + CLS on hydration.
 */
export default function PeopleLoading() {
  return null;
}

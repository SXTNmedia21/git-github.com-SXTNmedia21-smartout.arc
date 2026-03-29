/**
 * Home index — FAB landing page.
 * Redirects to shift-hub (phase-aware home screen).
 * Only reached via the center FAB button, not from the tab bar.
 */

import { Redirect } from "expo-router";

export default function HomeIndex() {
  return <Redirect href="/(app)/(home)/shift-hub" />;
}

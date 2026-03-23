/**
 * Entry screen — redirects to auth welcome immediately.
 * AuthProvider handles the actual routing (welcome vs app) based on session state.
 */
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/(auth)/welcome" />;
}

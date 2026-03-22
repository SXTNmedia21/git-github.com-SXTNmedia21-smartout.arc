/**
 * Channels group layout — stack navigator for channel list and conversation screens.
 * Header hidden on index (uses its own header). Conversation screen shows channel name.
 */
import { Stack } from "expo-router";

export default function ChannelsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}

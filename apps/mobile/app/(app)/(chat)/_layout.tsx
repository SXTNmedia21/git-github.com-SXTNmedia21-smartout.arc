/**
 * Chat group layout — stack navigator for channel list and conversation screens.
 * Header is hidden on the index (channel list uses its own header).
 * The conversation screen shows a custom header with the channel name.
 */
import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}

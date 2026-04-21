import { useLocalSearchParams } from "expo-router";
import { ConversationScreen } from "@/components/chat/ConversationScreen";

export default function NotificationChatPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationScreen channelId={id ?? ""} />;
}

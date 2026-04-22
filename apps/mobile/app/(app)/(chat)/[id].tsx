import { useLocalSearchParams } from "expo-router";
import { ConversationScreen } from "@/components/chat/ConversationScreen";

export default function ChatConversationPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationScreen channelId={id ?? ""} />;
}

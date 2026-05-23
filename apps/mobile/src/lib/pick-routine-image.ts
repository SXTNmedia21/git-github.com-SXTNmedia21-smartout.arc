// Native image picker for the routine photo→draft flow.
// Returns a local asset URI (uploadRoutineSource fetches it), or null if
// cancelled / permission denied. Web build uses pick-routine-image.web.ts.
import * as ImagePicker from "expo-image-picker";

export async function pickRoutineImage(): Promise<string | Blob | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  return picked.assets[0].uri;
}

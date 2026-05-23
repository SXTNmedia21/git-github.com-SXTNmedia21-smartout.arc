// Web/PWA image picker for the routine photo→draft flow.
// expo-image-picker is stubbed on web (metro alias → image-picker.web.ts), so the
// only working capture path in a browser is a standard file input. `capture` hints
// mobile browsers to open the camera. Returns the chosen File, or null if dismissed.
export async function pickRoutineImage(): Promise<string | Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

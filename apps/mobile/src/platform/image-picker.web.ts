/**
 * Web fallback for expo-image-picker.
 * Image/video picking is not available on web for beta.
 * Metro resolves `expo-image-picker` to this file when building for web.
 */

export enum MediaTypeOptions {
  All = "All",
  Images = "Images",
  Videos = "Videos",
}

export enum CameraType {
  front = "front",
  back = "back",
}

export type ImagePickerResult = {
  canceled: boolean;
  assets: null;
};

const cancelledResult: ImagePickerResult = { canceled: true, assets: null };

export async function launchCameraAsync(): Promise<ImagePickerResult> {
  return cancelledResult;
}

export async function launchImageLibraryAsync(): Promise<ImagePickerResult> {
  return cancelledResult;
}

export async function requestCameraPermissionsAsync() {
  return { status: "denied" as const, granted: false, canAskAgain: false };
}

export async function requestMediaLibraryPermissionsAsync() {
  return { status: "denied" as const, granted: false, canAskAgain: false };
}

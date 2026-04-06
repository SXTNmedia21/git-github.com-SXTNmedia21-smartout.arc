/**
 * Web fallback for expo-haptics.
 * All methods are no-ops — haptic feedback is not available in browsers.
 * Metro resolves `expo-haptics` to this file when building for web platform.
 */

export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
  Soft = "soft",
  Rigid = "rigid",
}

export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}

export async function impactAsync(_style?: ImpactFeedbackStyle): Promise<void> {}

export async function notificationAsync(_type?: NotificationFeedbackType): Promise<void> {}

export async function selectionAsync(): Promise<void> {}

// Support both `import * as Haptics` and `import Haptics from`
export default {
  impactAsync,
  notificationAsync,
  selectionAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

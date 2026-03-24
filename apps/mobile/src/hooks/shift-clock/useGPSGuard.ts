/**
 * useGPSGuard — GPS permission and position hook for shift clock validation.
 *
 * Wraps expo-location to:
 *   1. Request foreground location permission
 *   2. Fetch the current position with high accuracy
 *   3. Expose calculateGPSDistance from the shared package for workspace
 *      geofence checks (e.g. "employee must be within 200m of the venue").
 *
 * This hook does NOT enforce the geofence — it only supplies the position
 * snapshot. The caller (e.g. useShiftClock) decides whether to block or warn.
 */

import { useState, useCallback } from "react";
import * as Location from "expo-location";

import { calculateGPSDistance } from "@smartout/shift-clock";
import type { GPSSnapshot, GPSConfig } from "@smartout/shift-clock";

export type GPSPermissionStatus = "undetermined" | "granted" | "denied";

export type GPSGuardResult = {
  /** Current permission status */
  permissionStatus: GPSPermissionStatus;
  /** True while requesting permission or fetching position */
  isLoading: boolean;
  /** Last error from permission request or position fetch */
  error: string | null;
  /**
   * Request permission and fetch a fresh GPS snapshot.
   * Returns null if permission is denied or position unavailable.
   */
  getPosition: () => Promise<GPSSnapshot | null>;
  /**
   * Checks whether the given snapshot is within the geofence defined by
   * the workspace GPSConfig. Returns true if GPS is not required.
   */
  isWithinGeofence: (snapshot: GPSSnapshot, config: GPSConfig) => boolean;
};

/** High-accuracy position options with a 10-second timeout */
const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 0,
  distanceInterval: 0,
  mayShowUserSettingsDialog: true,
};

const POSITION_TIMEOUT_MS = 10_000;

/**
 * Resolves the expo-location PermissionStatus to our simplified tri-state.
 * "undetermined" means the user has not yet been asked.
 */
function mapPermissionStatus(status: Location.PermissionStatus): GPSPermissionStatus {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

/**
 * Hook: provides GPS permission management and position fetching for shift clock.
 *
 * Call getPosition() before punchIn() when the workspace requires GPS validation.
 * Use isWithinGeofence() with the returned snapshot and the workspace GPSConfig
 * to decide whether to allow the punch or show a warning.
 */
export function useGPSGuard(): GPSGuardResult {
  const [permissionStatus, setPermissionStatus] = useState<GPSPermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Requests foreground location permission (if not yet granted), then fetches
   * the current position with high accuracy and a 10-second timeout.
   *
   * Returns a GPSSnapshot on success, null if permission is denied or the
   * position fetch times out / fails.
   */
  const getPosition = useCallback(async (): Promise<GPSSnapshot | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check existing permission before requesting — avoids showing the system
      // dialog again if the user already granted it
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== Location.PermissionStatus.GRANTED) {
        const { status: requestedStatus } = await Location.requestForegroundPermissionsAsync();
        finalStatus = requestedStatus;
      }

      const mappedStatus = mapPermissionStatus(finalStatus);
      setPermissionStatus(mappedStatus);

      if (finalStatus !== Location.PermissionStatus.GRANTED) {
        setError("Tilgang til plassering ble avvist");
        return null;
      }

      // Race the position fetch against a timeout to avoid hanging the UI
      const positionPromise = Location.getCurrentPositionAsync(LOCATION_OPTIONS);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("GPS-tidsavbrudd")), POSITION_TIMEOUT_MS),
      );

      const location = await Promise.race([positionPromise, timeoutPromise]);

      const snapshot: GPSSnapshot = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 0,
        timestamp: new Date(location.timestamp).toISOString(),
      };

      return snapshot;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent GPS-feil";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Returns true if the employee is within the workspace geofence, or if GPS
   * is not required for this workspace. Delegates distance math to the shared
   * calculateGPSDistance utility so the logic stays platform-agnostic.
   */
  const isWithinGeofence = useCallback((snapshot: GPSSnapshot, config: GPSConfig): boolean => {
    if (!config.required) return true;
    if (config.referenceLat === null || config.referenceLng === null) return true;

    const distanceMeters = calculateGPSDistance(
      snapshot.lat,
      snapshot.lng,
      config.referenceLat,
      config.referenceLng,
    );

    return distanceMeters <= config.radiusMeters;
  }, []);

  return {
    permissionStatus,
    isLoading,
    error,
    getPosition,
    isWithinGeofence,
  };
}

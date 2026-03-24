"use client";

/**
 * useGPSGuard.ts — Wrapper around navigator.geolocation.getCurrentPosition().
 * Gets the device GPS position and validates it against the workspace GPS config.
 *
 * Returns distance from reference point (if configured) and whether the user
 * is within the allowed radius. Used by ShiftClock to enforce location-based
 * punch-in/out rules.
 *
 * Connected to: useShiftClock, PunchButton
 */

import { useCallback, useState } from "react";
import { calculateGPSDistance, type GPSSnapshot, type GPSConfig } from "@smartout/shift-clock";

type GPSResult = {
  snapshot: GPSSnapshot;
  distance: number | null;
  withinRadius: boolean;
};

export function useGPSGuard() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPosition = useCallback(async (config: GPSConfig | null): Promise<GPSResult | null> => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const snapshot: GPSSnapshot = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      };

      let distance: number | null = null;
      let withinRadius = true;

      // Only compute distance if reference coordinates are configured
      if (config?.referenceLat != null && config?.referenceLng != null) {
        distance = calculateGPSDistance(
          snapshot.lat,
          snapshot.lng,
          config.referenceLat,
          config.referenceLng,
        );
        withinRadius = distance <= config.radiusMeters;
      }

      return { snapshot, distance, withinRadius };
    } catch (err) {
      const geoError = err as GeolocationPositionError;
      setError(geoError.message || "GPS unavailable");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getPosition, isLoading, error };
}

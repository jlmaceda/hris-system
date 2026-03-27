import { useCallback, useState } from "react";

export type UserCoordinates = {
  latitude: number;
  longitude: number;
};

type GeolocationState = {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
};

const defaultOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

function mapGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Allow access in your browser settings.";
    case err.POSITION_UNAVAILABLE:
      return "Location information is unavailable.";
    case err.TIMEOUT:
      return "Getting location timed out.";
    default:
      return err.message || "Could not get location.";
  }
}

/**
 * One-shot location using `navigator.geolocation.getCurrentPosition`.
 * Rejects with an Error whose message handles permission denied and other cases.
 */
export function getUserLocation(options: PositionOptions = defaultOptions): Promise<UserCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      err => {
        reject(new Error(mapGeolocationError(err)));
      },
      options
    );
  });
}

/**
 * React hook: call `requestLocation()` to fetch coordinates.
 * Tracks `loading`, `error` (e.g. permission denied), and `latitude` / `longitude`.
 */
export function useGeolocation(options: PositionOptions = defaultOptions) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    loading: false,
    error: null,
  });

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState(s => ({
        ...s,
        loading: false,
        error: "Geolocation is not supported in this browser.",
      }));
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      position => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
        });
      },
      err => {
        setState(s => ({
          ...s,
          loading: false,
          error: mapGeolocationError(err),
        }));
      },
      options
    );
  }, [options.enableHighAccuracy, options.maximumAge, options.timeout]);

  return {
    latitude: state.latitude,
    longitude: state.longitude,
    loading: state.loading,
    error: state.error,
    requestLocation,
  };
}

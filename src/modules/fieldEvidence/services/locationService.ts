// src/modules/fieldEvidence/services/locationService.ts
export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export function getCurrentLocation(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          reject(new Error('Invalid coordinates returned'));
          return;
        }
        resolve({
          latitude,
          longitude,
          accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('User denied GPS permission'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Position unavailable'));
            break;
          case err.TIMEOUT:
            reject(new Error('GPS request timed out'));
            break;
          default:
            reject(new Error('Geolocation error'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

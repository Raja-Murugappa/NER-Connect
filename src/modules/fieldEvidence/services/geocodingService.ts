// src/modules/fieldEvidence/services/geocodingService.ts
/**
 * Reverse geocode using OpenStreetMap Nominatim.
 * Returns a display name or a fallback string.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const response = await fetch(url, {
      headers: {
        // Nominatim requires a user-agent identifying the application.
        'User-Agent': 'GeoTagFieldEvidence/1.0 (your-email@example.com)',
        'Accept-Language': 'en',
      },
    });
    if (!response.ok) throw new Error('Geocode request failed');
    const data = await response.json();
    if (data && data.display_name) {
      return data.display_name;
    }
    return 'Location unavailable';
  } catch (e) {
    console.error('Reverse geocode error:', e);
    return 'Location unavailable';
  }
}

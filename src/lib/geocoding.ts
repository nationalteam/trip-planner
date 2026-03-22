import { normalizeCoordinates } from '@/lib/coordinates';

interface GoogleGeocodeResponse {
  status?: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
}

export async function geocodeWithGoogleMaps(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address.trim()) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    console.error('Google Maps geocoding request failed', error);
    return null;
  }

  if (!response.ok) {
    console.error(`Google Maps geocoding request returned HTTP ${response.status}`);
    return null;
  }

  const data = await response.json() as GoogleGeocodeResponse;
  if (data.status !== 'OK' || !data.results?.length) {
    console.error(`Google Maps geocoding failed with status: ${data.status ?? 'UNKNOWN'}`);
    return null;
  }

  const location = data.results[0].geometry?.location;
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;

  return normalizeCoordinates(location.lat, location.lng);
}

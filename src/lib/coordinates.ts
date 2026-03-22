export interface Coordinates {
  lat: number;
  lng: number;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isValidRange(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function normalizeCoordinates(latValue: unknown, lngValue: unknown): Coordinates | null {
  const lat = toFiniteNumber(latValue);
  const lng = toFiniteNumber(lngValue);

  if (lat === null || lng === null) return null;

  if (isValidRange(lat, lng)) {
    return { lat, lng };
  }

  if (isValidRange(lng, lat)) {
    return { lat: lng, lng: lat };
  }

  return null;
}

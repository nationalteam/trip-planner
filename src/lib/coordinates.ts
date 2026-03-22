export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Approximate geographic centers for common trip destinations.
 * Used as a fallback reference when no existing proposals can provide an anchor
 * for resolving ambiguous lat/lng swaps.
 */
const CITY_CENTERS: Record<string, Coordinates> = {
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  athens: { lat: 37.9838, lng: 23.7275 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  beijing: { lat: 39.9042, lng: 116.4074 },
  berlin: { lat: 52.5200, lng: 13.4050 },
  buenos_aires: { lat: -34.6037, lng: -58.3816 },
  cairo: { lat: 30.0444, lng: 31.2357 },
  cape_town: { lat: -33.9249, lng: 18.4241 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  hong_kong: { lat: 22.3193, lng: 114.1694 },
  istanbul: { lat: 41.0082, lng: 28.9784 },
  jakarta: { lat: -6.2088, lng: 106.8456 },
  kuala_lumpur: { lat: 3.1390, lng: 101.6869 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  lisbon: { lat: 38.7223, lng: -9.1393 },
  london: { lat: 51.5074, lng: -0.1278 },
  los_angeles: { lat: 34.0522, lng: -118.2437 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  mexico_city: { lat: 19.4326, lng: -99.1332 },
  miami: { lat: 25.7617, lng: -80.1918 },
  milan: { lat: 45.4642, lng: 9.1900 },
  montreal: { lat: 45.5017, lng: -73.5673 },
  moscow: { lat: 55.7558, lng: 37.6173 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  munich: { lat: 48.1351, lng: 11.5820 },
  nairobi: { lat: -1.2921, lng: 36.8219 },
  new_york: { lat: 40.7128, lng: -74.0060 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  paris: { lat: 48.8566, lng: 2.3522 },
  prague: { lat: 50.0755, lng: 14.4378 },
  rome: { lat: 41.9028, lng: 12.4964 },
  san_francisco: { lat: 37.7749, lng: -122.4194 },
  santiago: { lat: -33.4489, lng: -70.6693 },
  seoul: { lat: 37.5665, lng: 126.9780 },
  shanghai: { lat: 31.2304, lng: 121.4737 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  taipei: { lat: 25.0330, lng: 121.5654 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  toronto: { lat: 43.6532, lng: -79.3832 },
  vancouver: { lat: 49.2827, lng: -123.1207 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  warsaw: { lat: 52.2297, lng: 21.0122 },
  zurich: { lat: 47.3769, lng: 8.5417 },
};

/**
 * Return the approximate center coordinates for a named city, or null if unknown.
 * The lookup is case-insensitive and normalises common separators (spaces → underscores).
 */
export function getCityCenter(city: string): Coordinates | null {
  const key = city.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return CITY_CENTERS[key] ?? null;
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

interface CoordinateCandidate {
  original: Coordinates;
  swapped: Coordinates;
  originalValid: boolean;
  swappedValid: boolean;
}

interface CoordinateBearing {
  lat: unknown;
  lng: unknown;
}

interface NormalizeBatchOptions {
  reference?: Coordinates;
}

function toCandidate(point: CoordinateBearing): CoordinateCandidate | null {
  const lat = toFiniteNumber(point.lat);
  const lng = toFiniteNumber(point.lng);
  if (lat === null || lng === null) return null;

  return {
    original: { lat, lng },
    swapped: { lat: lng, lng: lat },
    originalValid: isValidRange(lat, lng),
    swappedValid: isValidRange(lng, lat),
  };
}

function squaredDistance(a: Coordinates, b: Coordinates): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function centroid(points: Coordinates[]): Coordinates {
  const total = points.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

export function normalizeCoordinateBatch<T extends CoordinateBearing>(
  items: T[],
  options: NormalizeBatchOptions = {},
): Array<Omit<T, 'lat' | 'lng'> & Coordinates> {
  const parsed = items.map((item) => ({ item, candidate: toCandidate(item) }));
  const anchors: Coordinates[] = [];

  for (const entry of parsed) {
    const candidate = entry.candidate;
    if (!candidate) continue;

    if (candidate.originalValid && !candidate.swappedValid) {
      anchors.push(candidate.original);
      continue;
    }

    if (candidate.swappedValid && !candidate.originalValid) {
      anchors.push(candidate.swapped);
    }
  }

  const anchorCenter = anchors.length > 0 ? centroid(anchors) : options.reference ?? null;

  return parsed
    .map((entry) => {
      const candidate = entry.candidate;
      if (!candidate) return null;

      if (!candidate.originalValid && !candidate.swappedValid) {
        return null;
      }

      if (candidate.originalValid && !candidate.swappedValid) {
        return { ...entry.item, ...candidate.original };
      }

      if (candidate.swappedValid && !candidate.originalValid) {
        return { ...entry.item, ...candidate.swapped };
      }

      if (!anchorCenter) {
        return { ...entry.item, ...candidate.original };
      }

      const distOriginal = squaredDistance(candidate.original, anchorCenter);
      const distSwapped = squaredDistance(candidate.swapped, anchorCenter);
      const chosen = distSwapped < distOriginal ? candidate.swapped : candidate.original;
      return { ...entry.item, ...chosen };
    })
    .filter((item): item is T & Coordinates => item !== null);
}

export function getCoordinateCentroid<T extends CoordinateBearing>(items: T[]): Coordinates | null {
  const normalized = normalizeCoordinateBatch(items);
  if (normalized.length === 0) return null;
  return centroid(normalized);
}

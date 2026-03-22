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

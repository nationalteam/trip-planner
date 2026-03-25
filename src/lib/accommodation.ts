import { isValidDateOnly } from '@/lib/dates';

export type AccommodationLike = {
  id: string;
  tripId?: string;
  name?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  checkInDate: string;
  checkOutDate: string;
  createdAt?: Date;
};

export type AccommodationInputRange = {
  id?: string;
  checkInDate: string;
  checkOutDate: string;
};

export type DailyAccommodationRow = {
  day: number;
  date: string;
  accommodation: AccommodationLike | null;
};

function parseDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export function isValidAccommodationRange(checkInDate: string, checkOutDate: string): boolean {
  if (!isValidDateOnly(checkInDate) || !isValidDateOnly(checkOutDate)) return false;
  return parseDateOnly(checkInDate).getTime() < parseDateOnly(checkOutDate).getTime();
}

export function detectOverlappingAccommodation(
  candidate: AccommodationInputRange,
  existing: AccommodationInputRange[]
): boolean {
  const candidateStart = parseDateOnly(candidate.checkInDate).getTime();
  const candidateEnd = parseDateOnly(candidate.checkOutDate).getTime();

  return existing.some((item) => {
    if (candidate.id && item.id === candidate.id) return false;
    const start = parseDateOnly(item.checkInDate).getTime();
    const end = parseDateOnly(item.checkOutDate).getTime();
    return candidateStart < end && start < candidateEnd;
  });
}

export function buildDailyAccommodationPlan(input: {
  startDate: string | null | undefined;
  durationDays: number | null | undefined;
  accommodations: AccommodationLike[];
}): DailyAccommodationRow[] {
  if (!input.startDate || !isValidDateOnly(input.startDate)) return [];
  if (!Number.isInteger(input.durationDays) || Number(input.durationDays) <= 0) return [];

  const base = parseDateOnly(input.startDate);
  const result: DailyAccommodationRow[] = [];
  const sorted = [...input.accommodations].sort((a, b) => {
    if (a.checkInDate !== b.checkInDate) return a.checkInDate.localeCompare(b.checkInDate);
    return a.id.localeCompare(b.id);
  });

  for (let i = 0; i < input.durationDays; i += 1) {
    const current = new Date(base);
    current.setUTCDate(base.getUTCDate() + i);
    const date = current.toISOString().slice(0, 10);
    const accommodation = sorted.find((item) => item.checkInDate <= date && date < item.checkOutDate) ?? null;
    result.push({ day: i + 1, date, accommodation });
  }

  return result;
}

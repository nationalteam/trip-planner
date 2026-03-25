import type { Activity, ItineraryItem } from './types';

type RawItineraryItem = Omit<ItineraryItem, 'activity'> & {
  activity?: Activity | null;
};

export function normalizeActivities(value: unknown): Activity[] {
  if (!Array.isArray(value)) return [];
  return value as Activity[];
}

export function normalizeItineraryItems(value: unknown): ItineraryItem[] {
  if (!Array.isArray(value)) return [];

  return (value as RawItineraryItem[])
    .map((item) => {
      const activity = item.activity;
      if (!activity) return null;
      return {
        ...item,
        activity,
      };
    })
    .filter((item): item is ItineraryItem => item !== null);
}

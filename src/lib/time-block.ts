export const ITINERARY_TIME_BLOCKS = ['morning', 'lunch', 'afternoon', 'dinner', 'night'] as const;

export type ItineraryTimeBlock = (typeof ITINERARY_TIME_BLOCKS)[number];

export const ITINERARY_TIME_BLOCK_LABELS: Record<ItineraryTimeBlock, string> = {
  morning: '🌅 Morning',
  lunch: '🌞 Lunch',
  afternoon: '🌤 Afternoon',
  dinner: '🌙 Evening / Dinner',
  night: '🌃 Night',
};

const timeBlockIndex = new Map(ITINERARY_TIME_BLOCKS.map((block, index) => [block, index]));

export function isItineraryTimeBlock(value: string): value is ItineraryTimeBlock {
  return timeBlockIndex.has(value as ItineraryTimeBlock);
}

export function compareItineraryTimeBlock(a: string, b: string): number {
  const aIndex = timeBlockIndex.get(a as ItineraryTimeBlock);
  const bIndex = timeBlockIndex.get(b as ItineraryTimeBlock);
  if (aIndex == null && bIndex == null) return 0;
  if (aIndex == null) return 1;
  if (bIndex == null) return -1;
  return aIndex - bIndex;
}

export function normalizeSuggestedTimeToTimeBlock(suggestedTime: string): ItineraryTimeBlock {
  if (isItineraryTimeBlock(suggestedTime)) return suggestedTime;
  return 'afternoon';
}

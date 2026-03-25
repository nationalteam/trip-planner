import { normalizeActivities, normalizeItineraryItems } from '@/app/trips/[id]/adapters';

describe('trip detail adapters', () => {
  it('normalizes activity array payloads', () => {
    const input = [
      {
        id: 'p-1',
        title: 'Louvre',
        status: 'pending',
      },
    ];

    expect(normalizeActivities(input)).toEqual([
      {
        id: 'p-1',
        title: 'Louvre',
        status: 'pending',
      },
    ]);
  });

  it('keeps itinerary items with activity field', () => {
    const input = [
      {
        id: 'ii-1',
        day: 1,
        timeBlock: 'morning',
        order: 0,
        activity: {
          id: 'p-1',
          title: 'Eiffel Tower',
          description: 'Iconic landmark',
        },
      },
    ];

    expect(normalizeItineraryItems(input)).toEqual([
      {
        id: 'ii-1',
        day: 1,
        timeBlock: 'morning',
        order: 0,
        activity: {
          id: 'p-1',
          title: 'Eiffel Tower',
          description: 'Iconic landmark',
        },
      },
    ]);
  });

  it('drops itinerary items when activity field is missing', () => {
    const input = [
      {
        id: 'ii-1',
        day: 1,
        timeBlock: 'morning',
        order: 0,
      },
    ];

    expect(normalizeItineraryItems(input)).toEqual([]);
  });
});

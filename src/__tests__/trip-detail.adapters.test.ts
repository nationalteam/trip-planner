import { normalizeActivities, normalizeItineraryItems } from '@/app/trips/[id]/adapters';

describe('trip detail adapters', () => {
  it('normalizes proposals array into activities', () => {
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

  it('normalizes itinerary proposal field into activity field', () => {
    const input = [
      {
        id: 'ii-1',
        day: 1,
        timeBlock: 'morning',
        order: 0,
        proposal: {
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

  it('prefers existing activity field when both activity and proposal are present', () => {
    const input = [
      {
        id: 'ii-1',
        day: 1,
        timeBlock: 'morning',
        order: 0,
        proposal: { id: 'p-proposal', title: 'Proposal version' },
        activity: { id: 'p-activity', title: 'Activity version' },
      },
    ];

    expect(normalizeItineraryItems(input)[0]?.activity).toEqual({
      id: 'p-activity',
      title: 'Activity version',
    });
  });
});

import { summarizePortfolioPriority } from '@/lib/portfolio-priority';

describe('summarizePortfolioPriority', () => {
  it('returns null when there are no trips to triage', () => {
    expect(summarizePortfolioPriority([])).toBeNull();
  });

  it('prioritizes trips that still need dates or duration', () => {
    const priority = summarizePortfolioPriority([
      {
        id: 'trip-1',
        name: 'Paris Atelier',
        createdAt: '2026-05-01T00:00:00.000Z',
        startDate: null,
        durationDays: null,
        counts: { activitiesCount: 4, itineraryItemsCount: 4 },
      },
      {
        id: 'trip-2',
        name: 'Tokyo Dining Week',
        createdAt: '2026-05-02T00:00:00.000Z',
        startDate: '2026-06-01',
        durationDays: 5,
        counts: { activitiesCount: 0, itineraryItemsCount: 0 },
      },
    ]);

    expect(priority).toEqual({
      tripId: 'trip-1',
      tripName: 'Paris Atelier',
      label: 'Frame the trip dates',
      detail: 'Add dates or duration so pacing, weather, and route decisions can be trusted.',
      actionLabel: 'Open dossier',
      priority: 1,
    });
  });

  it('guides curation before scheduling when a framed trip has no ideas', () => {
    const priority = summarizePortfolioPriority([
      {
        id: 'trip-1',
        name: 'Kyoto Retreat',
        createdAt: '2026-05-01T00:00:00.000Z',
        startDate: '2026-06-01',
        durationDays: 4,
        counts: { activitiesCount: 0, itineraryItemsCount: 0 },
      },
    ]);

    expect(priority?.label).toBe('Curate signature ideas');
    expect(priority?.detail).toBe('Start with destination-defining stays, tables, culture, and quiet luxury moments.');
    expect(priority?.priority).toBe(2);
  });

  it('surfaces unscheduled ideas as a flow priority', () => {
    const priority = summarizePortfolioPriority([
      {
        id: 'trip-1',
        name: 'Rome Weekend',
        createdAt: '2026-05-01T00:00:00.000Z',
        startDate: '2026-06-01',
        durationDays: 3,
        counts: { activitiesCount: 7, itineraryItemsCount: 4 },
      },
    ]);

    expect(priority?.label).toBe('Place remaining ideas');
    expect(priority?.detail).toBe('3 curated ideas still need a day and rhythm before the trip feels guest-ready.');
    expect(priority?.priority).toBe(4);
  });
});

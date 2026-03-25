import { buildDailyAccommodationPlan, detectOverlappingAccommodation } from '@/lib/accommodation';

describe('buildDailyAccommodationPlan', () => {
  it('maps check-in inclusive and check-out exclusive nights', () => {
    const result = buildDailyAccommodationPlan({
      startDate: '2026-04-01',
      durationDays: 4,
      accommodations: [
        {
          id: 'acc-1',
          tripId: 'trip-1',
          name: 'Hotel A',
          address: 'A street',
          lat: null,
          lng: null,
          notes: null,
          checkInDate: '2026-04-01',
          checkOutDate: '2026-04-03',
        },
      ],
    });

    expect(result).toHaveLength(4);
    expect(result[0].accommodation?.id).toBe('acc-1');
    expect(result[1].accommodation?.id).toBe('acc-1');
    expect(result[2].accommodation).toBeNull();
    expect(result[3].accommodation).toBeNull();
  });

  it('switches accommodation when ranges change', () => {
    const result = buildDailyAccommodationPlan({
      startDate: '2026-04-01',
      durationDays: 4,
      accommodations: [
        {
          id: 'acc-1',
          tripId: 'trip-1',
          name: 'Hotel A',
          address: 'A street',
          lat: null,
          lng: null,
          notes: null,
          checkInDate: '2026-04-01',
          checkOutDate: '2026-04-03',
        },
        {
          id: 'acc-2',
          tripId: 'trip-1',
          name: 'Hotel B',
          address: 'B street',
          lat: null,
          lng: null,
          notes: null,
          checkInDate: '2026-04-03',
          checkOutDate: '2026-04-05',
        },
      ],
    });

    expect(result.map((row) => row.accommodation?.id ?? null)).toEqual(['acc-1', 'acc-1', 'acc-2', 'acc-2']);
  });

  it('returns empty plan when schedule is missing', () => {
    expect(
      buildDailyAccommodationPlan({
        startDate: null,
        durationDays: 3,
        accommodations: [],
      })
    ).toEqual([]);
  });
});

describe('detectOverlappingAccommodation', () => {
  it('returns true when periods overlap', () => {
    expect(
      detectOverlappingAccommodation(
        { checkInDate: '2026-04-02', checkOutDate: '2026-04-04' },
        [{ id: 'acc-1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' }]
      )
    ).toBe(true);
  });

  it('returns false when periods only touch checkout boundary', () => {
    expect(
      detectOverlappingAccommodation(
        { checkInDate: '2026-04-03', checkOutDate: '2026-04-05' },
        [{ id: 'acc-1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' }]
      )
    ).toBe(false);
  });

  it('ignores current item by id', () => {
    expect(
      detectOverlappingAccommodation(
        { id: 'acc-1', checkInDate: '2026-04-02', checkOutDate: '2026-04-04' },
        [{ id: 'acc-1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' }]
      )
    ).toBe(false);
  });
});

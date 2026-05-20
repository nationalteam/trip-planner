import { summarizeItineraryDayPace } from '@/lib/itinerary-day-pacing';

describe('summarizeItineraryDayPace', () => {
  it('describes an open day when there are no timed stops', () => {
    expect(summarizeItineraryDayPace([])).toEqual({
      label: 'Open day',
      detail: 'No timed stops yet',
      totalMinutes: 0,
      stopCount: 0,
      unsizedCount: 0,
    });
  });

  it('summarizes a balanced day with total planned time', () => {
    expect(summarizeItineraryDayPace([90, 120])).toEqual({
      label: 'Balanced pace',
      detail: '2 stops · 3h 30m planned',
      totalMinutes: 210,
      stopCount: 2,
      unsizedCount: 0,
    });
  });

  it('includes unsized stops without counting them toward planned minutes', () => {
    expect(summarizeItineraryDayPace([60, null, 45])).toEqual({
      label: 'Relaxed pace',
      detail: '3 stops · 1h 45m planned · 1 unsized stop',
      totalMinutes: 105,
      stopCount: 3,
      unsizedCount: 1,
    });
  });

  it('flags dense days as intensive', () => {
    expect(summarizeItineraryDayPace([180, 180, 210])).toEqual({
      label: 'Intensive pace',
      detail: '3 stops · 9h 30m planned',
      totalMinutes: 570,
      stopCount: 3,
      unsizedCount: 0,
    });
  });
});

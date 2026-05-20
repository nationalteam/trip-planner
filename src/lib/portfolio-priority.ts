export interface PortfolioTripSummary {
  id: string;
  name: string;
  createdAt: string;
  startDate?: string | null;
  durationDays?: number | null;
  counts?: {
    activitiesCount: number;
    itineraryItemsCount: number;
  };
}

export interface PortfolioPrioritySummary {
  tripId: string;
  tripName: string;
  label: string;
  detail: string;
  actionLabel: string;
  priority: number;
}

function hasTripFrame(trip: PortfolioTripSummary): boolean {
  const hasStartDate = typeof trip.startDate === 'string' && trip.startDate.trim().length > 0;
  const hasDuration = typeof trip.durationDays === 'number' && trip.durationDays > 0;
  return hasStartDate || hasDuration;
}

function getTripPriority(trip: PortfolioTripSummary): PortfolioPrioritySummary {
  const activitiesCount = trip.counts?.activitiesCount ?? 0;
  const itineraryItemsCount = trip.counts?.itineraryItemsCount ?? 0;

  if (!hasTripFrame(trip)) {
    return {
      tripId: trip.id,
      tripName: trip.name,
      label: 'Frame the trip dates',
      detail: 'Add dates or duration so pacing, weather, and route decisions can be trusted.',
      actionLabel: 'Open dossier',
      priority: 1,
    };
  }

  if (activitiesCount === 0) {
    return {
      tripId: trip.id,
      tripName: trip.name,
      label: 'Curate signature ideas',
      detail: 'Start with destination-defining stays, tables, culture, and quiet luxury moments.',
      actionLabel: 'Start curation',
      priority: 2,
    };
  }

  if (itineraryItemsCount === 0) {
    return {
      tripId: trip.id,
      tripName: trip.name,
      label: 'Shape the day flow',
      detail: 'Arrange approved experiences into a graceful sequence before routing decisions.',
      actionLabel: 'Open itinerary',
      priority: 3,
    };
  }

  if (itineraryItemsCount < activitiesCount) {
    const remainingCount = activitiesCount - itineraryItemsCount;
    return {
      tripId: trip.id,
      tripName: trip.name,
      label: 'Place remaining ideas',
      detail: `${remainingCount} curated ${remainingCount === 1 ? 'idea' : 'ideas'} still need a day and rhythm before the trip feels guest-ready.`,
      actionLabel: 'Refine flow',
      priority: 4,
    };
  }

  return {
    tripId: trip.id,
    tripName: trip.name,
    label: 'Polish guest handoff',
    detail: 'Review pacing notes, map confidence, and sharing before the traveler receives the dossier.',
    actionLabel: 'Final review',
    priority: 5,
  };
}

function getCreatedAtTime(trip: PortfolioTripSummary): number {
  const time = new Date(trip.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function summarizePortfolioPriority(trips: PortfolioTripSummary[]): PortfolioPrioritySummary | null {
  if (trips.length === 0) return null;

  return trips
    .map(getTripPriority)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;

      const tripA = trips.find((trip) => trip.id === a.tripId);
      const tripB = trips.find((trip) => trip.id === b.tripId);
      return getCreatedAtTime(tripB ?? trips[0]) - getCreatedAtTime(tripA ?? trips[0]);
    })[0];
}

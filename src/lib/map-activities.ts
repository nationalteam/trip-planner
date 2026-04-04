type ActivityLike = {
  id: string;
  status: string;
};

type ItineraryItemLike = {
  activity?: {
    id: string;
  };
};

export type MapActivity<T extends ActivityLike> = T & {
  isArranged: boolean;
};

export function buildMapActivities<T extends ActivityLike>(
  activities: T[],
  itinerary: ItineraryItemLike[]
): Array<MapActivity<T>> {
  const arrangedActivityIds = new Set(
    itinerary
      .map((item) => item.activity?.id)
      .filter((id): id is string => Boolean(id))
  );
  return activities
    .filter((activity) => activity.status !== 'rejected')
    .map((activity) => ({
      ...activity,
      isArranged: arrangedActivityIds.has(activity.id),
    }));
}

export interface ItineraryRouteItem {
  activityId: string;
  day: number;
  lat: number;
  lng: number;
}

export const DAY_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#34495e',
];

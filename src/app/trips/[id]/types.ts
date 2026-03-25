export interface Trip {
  id: string;
  name: string;
  cities: string;
  createdAt: string;
  startDate?: string | null;
  durationDays?: number | null;
  itineraryVisibleDays?: number | null;
  currentRole?: 'owner' | 'viewer';
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  reason: string;
  lat: number;
  lng: number;
  city: string;
  suggestedTime: string;
  durationMinutes: number | null;
  status: string;
  googlePlaceId?: string | null;
  formattedAddress?: string | null;
  googleTypes?: string | null;
}

export interface ItineraryItem {
  id: string;
  day: number;
  timeBlock: string;
  order: number;
  activity: Activity;
  proposal?: Activity;
}

export type Proposal = Activity;

export type Tab = 'proposals' | 'itinerary' | 'map' | 'ai';
export type ChatPlanAction = { type: string; [key: string]: unknown };
export type ChatPlanResponse = { summary: string; actionPlan: ChatPlanAction[] };

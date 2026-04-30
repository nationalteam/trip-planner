/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripDetailPage from '@/app/trips/[id]/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'trip-1' }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/ActivityCard', () =>
  function MockActivityCard({ activity }: { activity: { title: string; status: string } }) {
    return <div data-testid="activity-card" data-status={activity.status}>{activity.title}</div>;
  }
);
jest.mock('@/components/ItineraryView', () => function MockItineraryView() {
  return <div data-testid="itinerary-view" />;
});
jest.mock('@/components/ConfirmDialog', () => function MockConfirmDialog() {
  return null;
});
jest.mock('@/components/MapView', () => function MockMapView() {
  return <div data-testid="map-view" />;
});
jest.mock('@/components/GoogleMapView', () => function MockGoogleMapView() {
  return <div data-testid="google-map-view" />;
});

const TRIP_RESPONSE = {
  id: 'trip-1',
  name: 'Paris Trip',
  cities: '["Paris"]',
  createdAt: '2026-03-24T00:00:00.000Z',
  currentRole: 'owner',
};

const PENDING_ACTIVITIES = [
  {
    id: 'a-1',
    type: 'place',
    title: 'Louvre Museum',
    description: 'Famous museum',
    reason: 'Must-see',
    lat: 48.86,
    lng: 2.33,
    city: 'Paris',
    suggestedTime: 'morning',
    durationMinutes: 120,
    status: 'pending',
  },
  {
    id: 'a-2',
    type: 'food',
    title: 'Café de Flore',
    description: 'Iconic café',
    reason: 'Classic Paris',
    lat: 48.85,
    lng: 2.33,
    city: 'Paris',
    suggestedTime: 'lunch',
    durationMinutes: 60,
    status: 'pending',
  },
];

function makeBaseFetchMock(activitiesOverride = PENDING_ACTIVITIES) {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url === '/api/trips/trip-1' && method === 'GET') {
      return { ok: true, status: 200, json: async () => TRIP_RESPONSE } as Response;
    }
    if (url.startsWith('/api/trips/trip-1/activities?') && method === 'GET') {
      return { ok: true, status: 200, json: async () => activitiesOverride } as Response;
    }
    if (url === '/api/trips/trip-1/itinerary' && method === 'GET') {
      return { ok: true, status: 200, json: async () => [] } as Response;
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
}

describe('Trip detail — Approve All', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('shows "Approve All" button with pending count when there are pending activities', async () => {
    global.fetch = makeBaseFetchMock() as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => expect(screen.getByText('Paris Trip')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /approve all \(2\)/i })).toBeInTheDocument();
  });

  it('does not show "Approve All" button when there are no pending activities', async () => {
    const approvedActivities = PENDING_ACTIVITIES.map((a) => ({ ...a, status: 'approved' }));
    global.fetch = makeBaseFetchMock(approvedActivities) as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => expect(screen.getByText('Paris Trip')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /approve all/i })).not.toBeInTheDocument();
  });

  it('shows a pending count badge on the Activities tab', async () => {
    global.fetch = makeBaseFetchMock() as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => expect(screen.getByText('Paris Trip')).toBeInTheDocument());

    // The badge should be scoped within the Activities tab element
    expect(screen.getByTestId('activities-tab-badge')).toHaveTextContent('2');
  });

  it('calls approve-all endpoint and updates state on click', async () => {
    const approvedActivities = PENDING_ACTIVITIES.map((a) => ({ ...a, status: 'approved' }));
    const newItineraryItems = approvedActivities.map((a, i) => ({
      id: `ii-${i + 1}`,
      day: i + 1,
      timeBlock: a.suggestedTime,
      order: 0,
      activity: a,
    }));

    const fetchMock = makeBaseFetchMock();
    // Override to handle approve-all POST
    const originalImpl = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/trips/trip-1/activities/approve-all' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ activities: approvedActivities, itineraryItems: newItineraryItems }),
        } as Response;
      }
      return originalImpl(input, init);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TripDetailPage />);

    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Paris Trip')).toBeInTheDocument());

    const approveAllBtn = screen.getByRole('button', { name: /approve all \(2\)/i });
    await user.click(approveAllBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/trips/trip-1/activities/approve-all',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // After approve all, button should disappear (no more pending)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /approve all/i })).not.toBeInTheDocument();
    });
  });
});

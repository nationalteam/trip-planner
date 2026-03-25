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

jest.mock('@/components/ProposalCard', () => function MockProposalCard() {
  return <div data-testid="proposal-card" />;
});
jest.mock('@/components/ItineraryView', () => function MockItineraryView() {
  return <div data-testid="itinerary-view" />;
});
jest.mock('@/components/ConfirmDialog', () => function MockConfirmDialog() {
  return null;
});
jest.mock('@/components/MapView', () => function MockMapView() {
  return <div data-testid="map-view" />;
});

const mockGoogleMapView = jest.fn(() => <div data-testid="google-map-view" />);
jest.mock('@/components/GoogleMapView', () => ({
  __esModule: true,
  default: (props: unknown) => mockGoogleMapView(props),
}));

describe('Trip detail map arranged state', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    mockGoogleMapView.mockClear();
  });

  it('passes non-rejected proposals to Google map with itinerary-based isArranged flag', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/trips/trip-1' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'trip-1',
            name: 'Japan Trip',
            cities: '["Tokyo"]',
            createdAt: '2026-03-24T00:00:00.000Z',
            currentRole: 'owner',
          }),
        } as Response;
      }

      if (url.startsWith('/api/trips/trip-1/activities?') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ([
            {
              id: 'p-arranged',
              type: 'place',
              title: 'Senso-ji',
              description: 'Temple',
              reason: '',
              lat: 35.7148,
              lng: 139.7967,
              city: 'Tokyo',
              suggestedTime: 'morning',
              durationMinutes: 90,
              status: 'pending',
            },
            {
              id: 'p-unarranged',
              type: 'food',
              title: 'Ramen Spot',
              description: 'Lunch',
              reason: '',
              lat: 35.67,
              lng: 139.7,
              city: 'Tokyo',
              suggestedTime: 'lunch',
              durationMinutes: 60,
              status: 'approved',
            },
            {
              id: 'p-rejected',
              type: 'place',
              title: 'Skipped',
              description: 'Nope',
              reason: '',
              lat: 35.68,
              lng: 139.71,
              city: 'Tokyo',
              suggestedTime: 'night',
              durationMinutes: 30,
              status: 'rejected',
            },
          ]),
        } as Response;
      }

      if (url === '/api/trips/trip-1/itinerary' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ([
            {
              id: 'i-1',
              day: 1,
              timeBlock: 'morning',
              order: 0,
              proposal: {
                id: 'p-arranged',
                type: 'place',
                title: 'Senso-ji',
                description: 'Temple',
                reason: '',
                lat: 35.7148,
                lng: 139.7967,
                city: 'Tokyo',
                suggestedTime: 'morning',
                durationMinutes: 90,
                status: 'approved',
              },
            },
          ]),
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Japan Trip')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /map/i }));

    await waitFor(() => {
      expect(mockGoogleMapView).toHaveBeenCalled();
    });

    const lastCall = mockGoogleMapView.mock.calls.at(-1);
    const props = lastCall?.[0] as { proposals?: Array<{ id: string; isArranged: boolean; status: string }>; focusTrigger?: number };
    expect(props.proposals).toEqual([
      expect.objectContaining({ id: 'p-arranged', isArranged: true, status: 'pending' }),
      expect.objectContaining({ id: 'p-unarranged', isArranged: false, status: 'approved' }),
    ]);
    expect(props.proposals?.find((proposal) => proposal.id === 'p-rejected')).toBeUndefined();
    expect(typeof props.focusTrigger).toBe('number');
  });

  it('increments map focus trigger when entering map tab', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/trips/trip-1' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'trip-1',
            name: 'Japan Trip',
            cities: '["Tokyo"]',
            createdAt: '2026-03-24T00:00:00.000Z',
            currentRole: 'owner',
          }),
        } as Response;
      }

      if (url.startsWith('/api/trips/trip-1/activities?') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ([
            {
              id: 'p-1',
              type: 'place',
              title: 'Senso-ji',
              description: 'Temple',
              reason: '',
              lat: 35.7148,
              lng: 139.7967,
              city: 'Tokyo',
              suggestedTime: 'morning',
              durationMinutes: 90,
              status: 'pending',
            },
          ]),
        } as Response;
      }

      if (url === '/api/trips/trip-1/itinerary' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ([]),
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Japan Trip')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /map/i }));
    await waitFor(() => {
      expect(mockGoogleMapView).toHaveBeenCalled();
    });
    const firstTrigger = (mockGoogleMapView.mock.calls.at(-1)?.[0] as { focusTrigger?: number }).focusTrigger;
    expect(typeof firstTrigger).toBe('number');

    await userEvent.click(screen.getByRole('button', { name: /proposals/i }));
    await userEvent.click(screen.getByRole('button', { name: /map/i }));
    await waitFor(() => {
      const nextTrigger = (mockGoogleMapView.mock.calls.at(-1)?.[0] as { focusTrigger?: number }).focusTrigger;
      expect(typeof nextTrigger).toBe('number');
      expect((nextTrigger as number) > (firstTrigger as number)).toBe(true);
    });
  });
});

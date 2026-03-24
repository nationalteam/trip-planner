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

jest.mock('@/components/ProposalCard', () => function MockProposalCard({ proposal }: { proposal: { title: string } }) {
  return <div data-testid="proposal-card">{proposal.title}</div>;
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
jest.mock('@/components/GoogleMapView', () => function MockGoogleMapView() {
  return <div data-testid="google-map-view" />;
});

describe('Trip detail chat planner', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('previews and confirms chat actions, then updates proposal list', async () => {
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

      if (url.startsWith('/api/trips/trip-1/proposals?') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        } as Response;
      }

      if (url === '/api/trips/trip-1/itinerary' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        } as Response;
      }

      if (url === '/api/trips/trip-1/chat/plan' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            summary: 'Will create one proposal.',
            actionPlan: [
              {
                type: 'proposal.create',
                title: 'Senso-ji',
                description: 'Temple visit',
                city: 'Tokyo',
              },
            ],
          }),
        } as Response;
      }

      if (url === '/api/trips/trip-1/chat/execute' && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ type: 'proposal.create', status: 'success' }],
            proposals: [
              {
                id: 'p-1',
                type: 'place',
                title: 'Senso-ji',
                description: 'Temple visit',
                reason: '',
                lat: 35.71,
                lng: 139.79,
                city: 'Tokyo',
                suggestedTime: 'morning',
                durationMinutes: 90,
                status: 'pending',
              },
            ],
            itinerary: [],
            trip: {
              id: 'trip-1',
              name: 'Japan Trip',
              cities: '["Tokyo"]',
              currentRole: 'owner',
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Japan Trip')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText(/ask chat planner/i), 'Add Senso-ji proposal');
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/will create one proposal/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /confirm apply/i }));

    await waitFor(() => {
      expect(screen.getByText('Senso-ji')).toBeInTheDocument();
    });
  });
});

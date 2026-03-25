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

jest.mock('@/components/ActivityCard', () => function MockActivityCard() {
  return <div data-testid="activity-card" />;
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

describe('Trip detail manual activity form', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('is collapsed by default and auto-collapses after successful submit', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/trips/trip-1' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'trip-1',
            name: 'Paris Trip',
            cities: '["Paris"]',
            createdAt: '2026-03-24T00:00:00.000Z',
            currentRole: 'owner',
          }),
        } as Response;
      }

      if (url.startsWith('/api/trips/trip-1/activities?') && method === 'GET') {
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

      if (url === '/api/trips/trip-1/activities' && method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 'manual-1',
            type: 'place',
            title: 'Louvre Museum',
            description: 'Great museum',
            reason: '',
            lat: 0,
            lng: 0,
            city: 'Paris',
            suggestedTime: 'afternoon',
            durationMinutes: null,
            status: 'pending',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris Trip')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /add activity manually/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add activity manually/i }));

    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Title'), 'Louvre Museum');
    await userEvent.clear(screen.getByPlaceholderText('Description'));
    await userEvent.type(screen.getByPlaceholderText('Description'), 'Great museum');

    await userEvent.click(screen.getByRole('button', { name: 'Add Manual Activity' }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
    });
  });

  it('toggles advanced details and updates aria-expanded state', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/trips/trip-1' && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'trip-1',
            name: 'Paris Trip',
            cities: '["Paris"]',
            createdAt: '2026-03-24T00:00:00.000Z',
            currentRole: 'owner',
          }),
        } as Response;
      }

      if (url.startsWith('/api/trips/trip-1/activities?') && method === 'GET') {
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

      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TripDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris Trip')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /add activity manually/i }));

    const advancedToggle = screen.getByRole('button', { name: /show advanced details/i });
    expect(advancedToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByPlaceholderText('Duration (minutes, optional)')).not.toBeInTheDocument();

    await userEvent.click(advancedToggle);

    expect(screen.getByRole('button', { name: /hide advanced details/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByPlaceholderText('Duration (minutes, optional)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /hide advanced details/i }));

    expect(screen.getByRole('button', { name: /show advanced details/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByPlaceholderText('Duration (minutes, optional)')).not.toBeInTheDocument();
  });
});

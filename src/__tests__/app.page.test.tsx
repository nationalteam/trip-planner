/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('Home page', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPush.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not crash when /api/trips returns a non-array payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ error: 'Unauthorized' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('No trips yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('My Trips')).toBeInTheDocument();
  });

  it('presents a professional travel planning hero with expert workflow cues', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    expect(await screen.findByText('Design journeys with expert-level clarity')).toBeInTheDocument();
    expect(screen.getByText('Curated discovery')).toBeInTheDocument();
    expect(screen.getByText('Concierge-grade itinerary craft')).toBeInTheDocument();
    expect(screen.getByText('Map-ready routes')).toBeInTheDocument();
  });

  it('sets a boutique luxury travel atelier tone', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    expect(await screen.findByText('Boutique luxury travel atelier')).toBeInTheDocument();
    expect(screen.getByText('Concierge-grade itinerary craft')).toBeInTheDocument();
  });

  it('communicates concierge-grade atelier standards', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    expect(await screen.findByText('Atelier standards')).toBeInTheDocument();
    expect(screen.getByText('Signature pace')).toBeInTheDocument();
    expect(screen.getByText('Table-first planning')).toBeInTheDocument();
    expect(screen.getByText('Quiet logistics')).toBeInTheDocument();
  });

  it('surfaces a concierge next move for the trip portfolio', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [
        {
          id: 'trip-1',
          name: 'Paris Atelier',
          cities: '["Paris"]',
          createdAt: '2026-05-01T00:00:00.000Z',
          startDate: null,
          durationDays: null,
          _count: { activities: 4, itineraryItems: 4 },
        },
      ],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    expect(await screen.findByText('Concierge next move')).toBeInTheDocument();
    expect(screen.getAllByText('Frame the trip dates').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paris Atelier').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Add dates or duration so pacing, weather, and route decisions can be trusted.').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /open dossier/i })).toHaveAttribute('href', '/trips/trip-1');
  });

  it('navigates to the new trip detail page after successful creation', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/trips' && method === 'GET') {
        return {
          status: 200,
          ok: true,
          json: async () => [],
        } as Response;
      }

      if (url === '/api/trips' && method === 'POST') {
        return {
          status: 201,
          ok: true,
          json: async () => ({
            id: 'new-trip-1',
            name: 'Japan Trip',
            cities: '["Tokyo"]',
            createdAt: '2026-04-30T00:00:00.000Z',
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('No trips yet')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /new trip/i }));
    await user.type(screen.getByPlaceholderText(/european summer/i), 'Japan Trip');
    await user.type(screen.getByPlaceholderText(/paris, rome/i), 'Tokyo');
    await user.click(screen.getByRole('button', { name: /create trip/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/trips/new-trip-1');
    });
  });
});

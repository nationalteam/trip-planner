import { POST } from '@/app/api/trips/[id]/proposals/fill/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/llm', () => ({
  fillProposalDetails: jest.fn(),
}));

jest.mock('@/lib/geocoding', () => ({
  geocodeWithGoogleMaps: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

import { prisma } from '@/lib/prisma';
import { fillProposalDetails } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockFill = fillProposalDetails as jest.Mock;
const mockGeocode = geocodeWithGoogleMaps as jest.Mock;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('POST /api/trips/[id]/proposals/fill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('returns filled proposal details including geocoded coordinates', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Hokkaido', cities: '["Hokkaido"]' };
    const fakeFill = {
      description: 'A famous ski resort in Hokkaido.',
      type: 'place',
      suggestedTime: 'morning',
      durationMinutes: 180,
    };
    const fakeGeocode = { lat: 43.104, lng: 142.374 };

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    mockFill.mockResolvedValue(fakeFill);
    mockGeocode.mockResolvedValue(fakeGeocode);

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals/fill', {
      method: 'POST',
      body: JSON.stringify({ title: 'Tomamu Ski Resort', city: 'Hokkaido' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Link')).toContain('/api/trips/trip-1/activities/fill');
    expect(data).toEqual({ ...fakeFill, lat: 43.104, lng: 142.374 });
    expect(mockFill).toHaveBeenCalledWith('Tomamu Ski Resort', 'Hokkaido');
    expect(mockGeocode).toHaveBeenCalledWith('Tomamu Ski Resort, Hokkaido');
  });

  it('returns null lat/lng when geocoding fails', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Test Trip', cities: '["Paris"]' };
    const fakeFill = { description: 'A place', type: 'place', suggestedTime: 'afternoon', durationMinutes: null };

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    mockFill.mockResolvedValue(fakeFill);
    mockGeocode.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals/fill', {
      method: 'POST',
      body: JSON.stringify({ title: 'Unknown Place', city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.lat).toBeNull();
    expect(data.lng).toBeNull();
  });

  it('returns 400 when title is missing', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Test Trip', cities: '["Paris"]' };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals/fill', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('title and city are required');
    expect(mockFill).not.toHaveBeenCalled();
  });

  it('returns 400 when city is missing', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Test Trip', cities: '["Paris"]' };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals/fill', {
      method: 'POST',
      body: JSON.stringify({ title: 'Eiffel Tower' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('title and city are required');
  });

  it('returns 404 when trip does not exist', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/bad-id/proposals/fill', {
      method: 'POST',
      body: JSON.stringify({ title: 'Eiffel Tower', city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'bad-id' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Trip not found');
  });

  it('returns 403 when user does not have owner role', async () => {
    mockRequireTripRole.mockResolvedValue({ ok: false });

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals/fill', {
      method: 'POST',
      body: JSON.stringify({ title: 'Eiffel Tower', city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);

    expect(res.status).toBe(403);
    expect(mockFill).not.toHaveBeenCalled();
  });
});

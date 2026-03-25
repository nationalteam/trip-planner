import { GET, POST } from '@/app/api/trips/[id]/activities/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    trip: {
      findUnique: jest.fn(),
    },
    preference: {
      findMany: jest.fn(),
    },
    tripMember: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/llm', () => ({
  generateActivities: jest.fn(),
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
import { generateActivities } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerate = generateActivities as jest.Mock;
const mockGeocodeWithGoogleMaps = geocodeWithGoogleMaps as jest.Mock;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('GET /api/trips/[id]/activities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('returns activities for a trip', async () => {
    const fakeProposals = [
      { id: 'p-1', tripId: 'trip-1', title: 'Eiffel Tower', status: 'pending' },
    ];
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue(fakeProposals);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Deprecation')).toBeNull();
    expect(res.headers.get('Link')).toBeNull();
    expect(data).toEqual(fakeProposals);
  });

  it('supports sorting activities by a specific field and direction', async () => {
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities?sortBy=title&order=asc');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);

    expect(res.status).toBe(200);
    expect(mockPrisma.activity.findMany).toHaveBeenCalledWith({
      where: { tripId: 'trip-1' },
      orderBy: { title: 'asc' },
    });
  });
});

describe('POST /api/trips/[id]/activities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGeocodeWithGoogleMaps.mockReset();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
    (mockPrisma.tripMember.findMany as jest.Mock).mockResolvedValue([{ userId: 'u-1' }]);
    (mockPrisma.activity.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it('returns 404 when trip does not exist', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/bad-id/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'bad-id' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Trip not found');
  });

  it('creates a manual activity without calling AI generation', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const savedProposal = {
      id: 'p-manual-1',
      tripId: 'trip-1',
      type: 'place',
      title: 'Louvre Museum',
      description: 'Want to visit manually',
      reason: '',
      lat: 48.8606,
      lng: 2.3376,
      city: 'Paris',
      suggestedTime: 'afternoon',
      durationMinutes: 120,
      status: 'pending',
    };

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    mockGeocodeWithGoogleMaps.mockResolvedValue({ lat: 48.8606, lng: 2.3376 });
    (mockPrisma.activity.create as jest.Mock).mockResolvedValue(savedProposal);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'manual',
        title: 'Louvre Museum',
        description: 'Want to visit manually',
        city: 'Paris',
        type: 'place',
        suggestedTime: 'afternoon',
        durationMinutes: 120,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(savedProposal);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockGeocodeWithGoogleMaps).toHaveBeenCalledWith('Louvre Museum, Paris');
    expect(mockPrisma.activity.create).toHaveBeenCalledWith({
      data: {
        tripId: 'trip-1',
        type: 'place',
        title: 'Louvre Museum',
        description: 'Want to visit manually',
        reason: '',
        lat: 48.8606,
        lng: 2.3376,
        city: 'Paris',
        suggestedTime: 'afternoon',
        durationMinutes: 120,
        status: 'pending',
      },
    });
  });

  it('returns 400 for invalid manual activity payload', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'manual',
        city: 'Paris',
        description: 'Missing title',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Manual activity requires non-empty title, description, and city');
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('uses manual coordinates directly when lat/lng are provided', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Tokyo Trip', cities: '["Tokyo"]' };
    const savedProposal = {
      id: 'p-manual-2',
      tripId: 'trip-1',
      type: 'place',
      title: 'Skytree',
      description: 'Manual with coordinates',
      reason: '',
      lat: 35.7101,
      lng: 139.8107,
      city: 'Tokyo',
      suggestedTime: 'afternoon',
      durationMinutes: null,
      status: 'pending',
    };

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.create as jest.Mock).mockResolvedValue(savedProposal);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'manual',
        title: 'Skytree',
        description: 'Manual with coordinates',
        city: 'Tokyo',
        lat: 35.7101,
        lng: 139.8107,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(savedProposal);
    expect(mockGeocodeWithGoogleMaps).not.toHaveBeenCalled();
    expect(mockPrisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lat: 35.7101,
        lng: 139.8107,
      }),
    });
  });

  it('creates a activity from google place payload with hotel type mapping', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Tokyo Trip', cities: '["Tokyo"]' };
    const savedProposal = {
      id: 'p-google-1',
      tripId: 'trip-1',
      type: 'hotel',
      title: 'Shinjuku Granbell Hotel',
      description: 'Imported from Google Maps',
      reason: '',
      lat: 35.694,
      lng: 139.703,
      city: 'Tokyo',
      suggestedTime: 'afternoon',
      durationMinutes: null,
      status: 'pending',
      googlePlaceId: 'google-place-1',
      formattedAddress: '2 Chome-14-5 Kabukicho, Shinjuku City, Tokyo',
      googleTypes: '["lodging","establishment"]',
    };

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.activity.create as jest.Mock).mockResolvedValue(savedProposal);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'google_place',
        placeId: 'google-place-1',
        title: 'Shinjuku Granbell Hotel',
        city: 'Tokyo',
        lat: 35.694,
        lng: 139.703,
        formattedAddress: '2 Chome-14-5 Kabukicho, Shinjuku City, Tokyo',
        types: ['lodging', 'establishment'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);

    expect(res.status).toBe(201);
    expect(mockPrisma.activity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'hotel',
        googlePlaceId: 'google-place-1',
      }),
    });
  });

  it('returns 409 when google place already exists in the trip', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Tokyo Trip', cities: '["Tokyo"]' };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.activity.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'google_place',
        placeId: 'google-place-1',
        title: 'Shinjuku Granbell Hotel',
        city: 'Tokyo',
        lat: 35.694,
        lng: 139.703,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);

    expect(res.status).toBe(409);
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid google place payload', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Tokyo Trip', cities: '["Tokyo"]' };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'google_place',
        placeId: '',
        title: '',
        lat: 'bad',
        lng: 139.703,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);

    expect(res.status).toBe(400);
    expect(mockPrisma.activity.create).not.toHaveBeenCalled();
  });

  it('generates and saves activities when trip exists', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const fakeGenerated = [
      {
        type: 'place',
        title: 'Louvre',
        description: 'Famous museum',
        reason: 'Art lover',
        lat: 48.86,
        lng: 2.33,
        city: 'Paris',
        suggestedTime: 'morning',
        durationMinutes: 120,
      },
    ];
    const savedProposals = [{ id: 'p-1', ...fakeGenerated[0], tripId: 'trip-1', status: 'pending' }];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([{ preferredLanguage: 'zh-TW' }]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    mockGenerate.mockResolvedValue(fakeGenerated);
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue(savedProposals);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(Array.isArray(data)).toBe(true);
    expect(mockGenerate).toHaveBeenCalledWith([{ preferredLanguage: 'zh-TW' }], 'Paris', []);
  });

  it('passes all existing activities (including pending) to generateActivities to avoid duplicates', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const existingProposals = [
      { id: 'p-0', tripId: 'trip-1', title: 'Eiffel Tower', status: 'pending' },
      { id: 'p-1', tripId: 'trip-1', title: 'Louvre', status: 'approved' },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue(existingProposals);
    mockGenerate.mockResolvedValue([]);
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    await POST(req, context);

    expect(mockGenerate).toHaveBeenCalledWith([], 'Paris', existingProposals);
  });

  it('normalizes obviously swapped latitude/longitude before saving activities', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const fakeGenerated = [
      {
        type: 'place',
        title: 'Louvre',
        description: 'Famous museum',
        reason: 'Art lover',
        lat: 136.7253,
        lng: 34.4548,
        city: 'Paris',
        suggestedTime: 'morning',
        durationMinutes: 120,
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    mockGenerate.mockResolvedValue(fakeGenerated);
    mockGeocodeWithGoogleMaps.mockResolvedValue({ lat: 136.7253, lng: 34.4548 });
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    await POST(req, context);

    expect(mockPrisma.activity.create).toHaveBeenCalledTimes(1);
    const createArg = (mockPrisma.activity.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.lat).toBe(34.4548);
    expect(createArg.data.lng).toBe(136.7253);
  });

  it('normalizes ambiguously swapped coordinates using existing activity reference centroid', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const existingProposals = [
      {
        id: 'existing-1',
        tripId: 'trip-1',
        type: 'place',
        title: 'Paris Center',
        description: 'Anchor',
        reason: '',
        lat: 48.8566,
        lng: 2.3522,
        city: 'Paris',
        suggestedTime: 'morning',
        durationMinutes: null,
        status: 'approved',
      },
    ];
    const fakeGenerated = [
      {
        type: 'place',
        title: 'Louvre',
        description: 'Famous museum',
        reason: 'Art lover',
        lat: 48.8606,
        lng: 2.3376,
        city: 'Paris',
        suggestedTime: 'morning',
        durationMinutes: 120,
      },
      {
        type: 'place',
        title: 'Eiffel Tower',
        description: 'Iconic tower',
        reason: 'Landmark',
        lat: 2.2945,
        lng: 48.8584,
        city: 'Paris',
        suggestedTime: 'afternoon',
        durationMinutes: 90,
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue(existingProposals);
    mockGenerate.mockResolvedValue(fakeGenerated);
    mockGeocodeWithGoogleMaps
      .mockResolvedValueOnce({ lat: 48.8606, lng: 2.3376 })
      .mockResolvedValueOnce({ lat: 2.2945, lng: 48.8584 });
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    await POST(req, context);

    expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2);
    expect(mockGeocodeWithGoogleMaps).toHaveBeenNthCalledWith(1, 'Louvre, Paris');
    expect(mockGeocodeWithGoogleMaps).toHaveBeenNthCalledWith(2, 'Eiffel Tower, Paris');
    const secondCreateArg = (mockPrisma.activity.create as jest.Mock).mock.calls[1][0];
    expect(secondCreateArg.data.lat).toBe(48.8584);
    expect(secondCreateArg.data.lng).toBe(2.2945);
  });

  it('saves activities by resolving lat/lng from Google Maps when LLM output has no coordinates', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const fakeGenerated = [
      {
        type: 'place',
        title: 'Louvre Museum',
        description: 'Famous museum',
        reason: 'Art lover',
        city: 'Paris',
        suggestedTime: 'morning',
        durationMinutes: 120,
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    mockGenerate.mockResolvedValue(fakeGenerated);
    mockGeocodeWithGoogleMaps.mockResolvedValue({ lat: 48.8606, lng: 2.3376 });
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    await POST(req, context);

    expect(mockPrisma.activity.create).toHaveBeenCalledTimes(1);
    expect(mockGeocodeWithGoogleMaps).toHaveBeenCalledWith('Louvre Museum, Paris');
    const createArg = (mockPrisma.activity.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.lat).toBe(48.8606);
    expect(createArg.data.lng).toBe(2.3376);
  });

  it('uses Google Maps coordinates instead of LLM-provided lat/lng when both exist', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const fakeGenerated = [
      {
        type: 'place',
        title: 'Louvre Museum',
        description: 'Famous museum',
        reason: 'Art lover',
        lat: 1.2345,
        lng: 6.789,
        city: 'Paris',
        suggestedTime: 'morning',
        durationMinutes: 120,
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    mockGenerate.mockResolvedValue(fakeGenerated);
    mockGeocodeWithGoogleMaps.mockResolvedValue({ lat: 48.8606, lng: 2.3376 });
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    await POST(req, context);

    const createArg = (mockPrisma.activity.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.lat).toBe(48.8606);
    expect(createArg.data.lng).toBe(2.3376);
  });

  it('does not save activities when geocoding fails, so unresolved places will not appear on map', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Trip', cities: '["Paris"]' };
    const fakeGenerated = [
      {
        type: 'place',
        title: 'Unknown Place',
        description: 'No geocoding result',
        reason: 'Edge case',
        city: 'Paris',
      },
      {
        type: 'place',
        title: 'Louvre Museum',
        description: 'Famous museum',
        reason: 'Art lover',
        city: 'Paris',
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    mockGenerate.mockResolvedValue(fakeGenerated);
    mockGeocodeWithGoogleMaps
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lat: 48.8606, lng: 2.3376 });
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    await POST(req, context);

    expect(mockGeocodeWithGoogleMaps).toHaveBeenCalledTimes(2);
    expect(mockPrisma.activity.create).toHaveBeenCalledTimes(1);
    const createArg = (mockPrisma.activity.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.title).toBe('Louvre Museum');
    expect(createArg.data.lat).toBe(48.8606);
    expect(createArg.data.lng).toBe(2.3376);
  });
});

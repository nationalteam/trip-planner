import { NextRequest } from 'next/server';
import { GET as listActivities, POST as createActivity } from '@/app/api/trips/[id]/activities/route';
import { POST as approveActivity } from '@/app/api/activities/[id]/approve/route';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
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
    itineraryItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/llm', () => ({
  generateProposals: jest.fn(),
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
import { generateProposals } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerateProposals = generateProposals as jest.Mock;
const mockGeocodeWithGoogleMaps = geocodeWithGoogleMaps as jest.Mock;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('activities route integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('GET /api/trips/[id]/activities returns data without deprecation headers', async () => {
    const fakeActivities = [{ id: 'a-1', tripId: 'trip-1', title: 'Senso-ji', status: 'pending' }];
    (mockPrisma.proposal.findMany as jest.Mock).mockResolvedValue(fakeActivities);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities?sortBy=title&order=asc');
    const res = await listActivities(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakeActivities);
    expect(res.headers.get('Deprecation')).toBeNull();
    expect(res.headers.get('Link')).toBeNull();
    expect(mockPrisma.proposal.findMany).toHaveBeenCalledWith({
      where: { tripId: 'trip-1' },
      orderBy: { title: 'asc' },
    });
  });

  it('POST /api/trips/[id]/activities (manual) creates activity without deprecation headers', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1', name: 'Tokyo', cities: '["Tokyo"]' });
    (mockPrisma.proposal.findMany as jest.Mock).mockResolvedValue([]);
    mockGeocodeWithGoogleMaps.mockResolvedValue({ lat: 35.7101, lng: 139.8107 });
    const saved = {
      id: 'a-1',
      tripId: 'trip-1',
      type: 'place',
      title: 'Skytree',
      description: 'Landmark',
      reason: '',
      lat: 35.7101,
      lng: 139.8107,
      city: 'Tokyo',
      suggestedTime: 'afternoon',
      durationMinutes: null,
      status: 'pending',
    };
    (mockPrisma.proposal.create as jest.Mock).mockResolvedValue(saved);

    const req = new NextRequest('http://localhost/api/trips/trip-1/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'manual',
        title: 'Skytree',
        description: 'Landmark',
        city: 'Tokyo',
      }),
    });

    const res = await createActivity(req, { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(saved);
    expect(res.headers.get('Deprecation')).toBeNull();
    expect(res.headers.get('Link')).toBeNull();
    expect(mockGenerateProposals).not.toHaveBeenCalled();
  });

  it('POST /api/activities/[id]/approve returns approved payload without deprecation headers', async () => {
    const baseProposal = {
      id: 'a-1',
      tripId: 'trip-1',
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
      itineraryItem: { id: 'ii-1', tripId: 'trip-1', proposalId: 'a-1', day: 1, timeBlock: 'morning' },
      createdAt: new Date(),
    };
    const updated = { ...baseProposal, status: 'approved' };
    const fullItem = { ...baseProposal.itineraryItem, proposal: updated };
    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(baseProposal);
    (mockPrisma.proposal.update as jest.Mock).mockResolvedValue(updated);
    (mockPrisma.itineraryItem.findUnique as jest.Mock).mockResolvedValue(fullItem);

    const req = new NextRequest('http://localhost/api/activities/a-1/approve', { method: 'POST' });
    const res = await approveActivity(req, { params: Promise.resolve({ id: 'a-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.proposal.status).toBe('approved');
    expect(res.headers.get('Deprecation')).toBeNull();
    expect(res.headers.get('Link')).toBeNull();
  });
});

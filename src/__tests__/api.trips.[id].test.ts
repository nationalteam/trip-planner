import { GET, DELETE } from '@/app/api/trips/[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    proposal: {
      deleteMany: jest.fn(),
    },
    itineraryItem: {
      deleteMany: jest.fn(),
    },
    tripMember: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

describe('GET /api/trips/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('returns the trip when found', async () => {
    const fakeTrip = {
      id: 'trip-1',
      name: 'Paris Adventure',
      cities: '["Paris"]',
      startDate: '2026-04-01',
      durationDays: 5,
      createdAt: new Date(),
    };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe('Paris Adventure');
    expect(data.startDate).toBe('2026-04-01');
    expect(data.durationDays).toBe(5);
    expect(data.currentRole).toBe('owner');
  });

  it('returns 404 when trip is not found', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/nonexistent');
    const context = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
  });
});

describe('DELETE /api/trips/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('deletes the trip and returns 204 when found', async () => {
    const fakeTrip = { id: 'trip-1', name: 'Paris Adventure', cities: '["Paris"]', createdAt: new Date() };
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(fakeTrip);
    (mockPrisma.itineraryItem.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.proposal.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.trip.delete as jest.Mock).mockResolvedValue(fakeTrip);

    const req = new NextRequest('http://localhost/api/trips/trip-1', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await DELETE(req, context);

    expect(res.status).toBe(204);
    expect(mockPrisma.itineraryItem.deleteMany).toHaveBeenCalledWith({ where: { tripId: 'trip-1' } });
    expect(mockPrisma.proposal.deleteMany).toHaveBeenCalledWith({ where: { tripId: 'trip-1' } });
    expect(mockPrisma.tripMember.deleteMany).toHaveBeenCalledWith({ where: { tripId: 'trip-1' } });
    expect(mockPrisma.trip.delete).toHaveBeenCalledWith({ where: { id: 'trip-1' } });
  });

  it('returns 404 when trip is not found', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/nonexistent', { method: 'DELETE' });
    const context = { params: Promise.resolve({ id: 'nonexistent' }) };
    const res = await DELETE(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
    expect(mockPrisma.trip.delete).not.toHaveBeenCalled();
  });
});

import { GET, POST } from '@/app/api/trips/[id]/accommodations/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
    },
    accommodation: {
      findMany: jest.fn(),
      create: jest.fn(),
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

describe('GET /api/trips/[id]/accommodations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'viewer' });
  });

  it('returns accommodations sorted by checkInDate', async () => {
    (mockPrisma.accommodation.findMany as jest.Mock).mockResolvedValue([{ id: 'acc-1' }]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/accommodations');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([{ id: 'acc-1' }]);
    expect(mockPrisma.accommodation.findMany).toHaveBeenCalledWith({
      where: { tripId: 'trip-1' },
      orderBy: [{ checkInDate: 'asc' }, { createdAt: 'asc' }],
    });
  });
});

describe('POST /api/trips/[id]/accommodations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1' });
    (mockPrisma.accommodation.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('creates an accommodation when payload is valid', async () => {
    (mockPrisma.accommodation.create as jest.Mock).mockResolvedValue({ id: 'acc-1', name: 'Hotel A' });

    const req = new NextRequest('http://localhost/api/trips/trip-1/accommodations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hotel A',
        address: 'Address A',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
        notes: 'Near station',
      }),
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);

    expect(res.status).toBe(201);
    expect(mockPrisma.accommodation.create).toHaveBeenCalledWith({
      data: {
        tripId: 'trip-1',
        name: 'Hotel A',
        address: 'Address A',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
        notes: 'Near station',
        lat: null,
        lng: null,
      },
    });
  });

  it('returns 400 when dates overlap existing accommodations', async () => {
    (mockPrisma.accommodation.findMany as jest.Mock).mockResolvedValue([
      { id: 'acc-old', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' },
    ]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/accommodations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hotel B',
        address: 'Address B',
        checkInDate: '2026-04-02',
        checkOutDate: '2026-04-04',
      }),
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/overlap/i);
    expect(mockPrisma.accommodation.create).not.toHaveBeenCalled();
  });

  it('returns 400 when checkInDate is not before checkOutDate', async () => {
    const req = new NextRequest('http://localhost/api/trips/trip-1/accommodations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hotel B',
        address: 'Address B',
        checkInDate: '2026-04-03',
        checkOutDate: '2026-04-03',
      }),
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);

    expect(res.status).toBe(400);
    expect(mockPrisma.accommodation.create).not.toHaveBeenCalled();
  });
});

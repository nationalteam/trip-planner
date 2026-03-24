import { POST, DELETE } from '@/app/api/trips/[id]/itinerary/days/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    itineraryItem: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

describe('POST /api/trips/[id]/itinerary/days', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('increments itineraryVisibleDays when trip has no durationDays', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({
      id: 'trip-1',
      durationDays: null,
      itineraryVisibleDays: 2,
    });
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue([{ day: 1 }]);
    (mockPrisma.trip.update as jest.Mock).mockResolvedValue({
      id: 'trip-1',
      durationDays: null,
      itineraryVisibleDays: 3,
    });

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary/days', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: { itineraryVisibleDays: 3 },
    });
    expect(data.trip.itineraryVisibleDays).toBe(3);
  });

  it('returns 400 when durationDays is set', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({
      id: 'trip-1',
      durationDays: 5,
      itineraryVisibleDays: null,
    });

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary/days', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/durationDays/i);
    expect(mockPrisma.trip.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/trips/[id]/itinerary/days', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('deletes an empty day, shifts later items, and decrements itineraryVisibleDays', async () => {
    const trip = {
      id: 'trip-1',
      durationDays: null,
      itineraryVisibleDays: 5,
    };
    const shiftedItems = [
      { id: 'ii-2', day: 2, timeBlock: 'morning', order: 0, proposal: { id: 'p-2', title: 'x' } },
    ];

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb({
        trip: {
          findUnique: jest.fn().mockResolvedValue(trip),
          update: jest.fn().mockResolvedValue({ ...trip, itineraryVisibleDays: 4 }),
        },
        itineraryItem: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ day: 4 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(shiftedItems),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      })
    );

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary/days', {
      method: 'DELETE',
      body: JSON.stringify({ day: 3 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await DELETE(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.trip.itineraryVisibleDays).toBe(4);
    expect(data.itinerary).toEqual(shiftedItems);
  });

  it('returns 400 when deleting a non-empty day', async () => {
    const trip = {
      id: 'trip-1',
      durationDays: null,
      itineraryVisibleDays: 3,
    };

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb({
        trip: {
          findUnique: jest.fn().mockResolvedValue(trip),
          update: jest.fn(),
        },
        itineraryItem: {
          findMany: jest.fn().mockResolvedValue([{ id: 'ii-1' }]),
          updateMany: jest.fn(),
        },
      })
    );

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary/days', {
      method: 'DELETE',
      body: JSON.stringify({ day: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await DELETE(req, context);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/empty day/i);
  });
});

import { POST } from '@/app/api/trips/[id]/activities/approve-all/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    itineraryItem: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireTripRole: jest.fn(),
  buildForbiddenResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

jest.mock('@/lib/time-block', () => ({
  normalizeSuggestedTimeToTimeBlock: jest.fn((s: string) => s || 'afternoon'),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth, requireTripRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRequireAuth = requireAuth as jest.Mock;
const mockRequireTripRole = requireTripRole as jest.Mock;

function makeReq(tripId: string) {
  return new NextRequest(`http://localhost/api/trips/${tripId}/activities/approve-all`, { method: 'POST' });
}

describe('POST /api/trips/[id]/activities/approve-all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    mockRequireTripRole.mockResolvedValue({ ok: true, role: 'owner' });
  });

  it('returns 401 when not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await POST(makeReq('trip-1'), { params: Promise.resolve({ id: 'trip-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not an owner', async () => {
    mockRequireTripRole.mockResolvedValue({ ok: false });

    const res = await POST(makeReq('trip-1'), { params: Promise.resolve({ id: 'trip-1' }) });
    expect(res.status).toBe(403);
  });

  it('returns empty arrays when there are no pending activities', async () => {
    (mockPrisma.activity.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));

    const res = await POST(makeReq('trip-1'), { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activities).toEqual([]);
    expect(data.itineraryItems).toEqual([]);
  });

  it('approves all pending activities and creates itinerary items', async () => {
    const pendingActivities = [
      { id: 'a-1', tripId: 'trip-1', suggestedTime: 'morning', status: 'pending', itineraryItem: null },
      { id: 'a-2', tripId: 'trip-1', suggestedTime: 'afternoon', status: 'pending', itineraryItem: null },
    ];
    const updatedActivities = pendingActivities.map((a) => ({ ...a, status: 'approved' }));
    const itineraryItems = [
      { id: 'ii-1', activityId: 'a-1', day: 1, timeBlock: 'morning', activity: updatedActivities[0] },
      { id: 'ii-2', activityId: 'a-2', day: 1, timeBlock: 'afternoon', activity: updatedActivities[1] },
    ];

    // First call: find pending activities; second call: find updated activities
    (mockPrisma.activity.findMany as jest.Mock)
      .mockResolvedValueOnce(pendingActivities)
      .mockResolvedValueOnce(updatedActivities);
    // First call: slot calculation (returns empty, all are new)
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue([]);
    // create now uses include: { activity: true } so returns the full item directly
    (mockPrisma.itineraryItem.create as jest.Mock)
      .mockResolvedValueOnce(itineraryItems[0])
      .mockResolvedValueOnce(itineraryItems[1]);
    (mockPrisma.activity.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));

    const res = await POST(makeReq('trip-1'), { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.activities).toHaveLength(2);
    expect(data.activities.every((a: { status: string }) => a.status === 'approved')).toBe(true);
    expect(data.itineraryItems).toHaveLength(2);
    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { tripId: 'trip-1', status: 'pending' },
      data: { status: 'approved' },
    });
  });

  it('skips creating itinerary items for activities that already have one', async () => {
    const existingItineraryItem = { id: 'ii-existing', activityId: 'a-1', day: 1, timeBlock: 'morning' };
    const pendingActivities = [
      { id: 'a-1', tripId: 'trip-1', suggestedTime: 'morning', status: 'pending', itineraryItem: existingItineraryItem },
    ];
    const updatedActivities = [{ ...pendingActivities[0], status: 'approved' }];
    const fullItem = { ...existingItineraryItem, activity: updatedActivities[0] };

    (mockPrisma.activity.findMany as jest.Mock)
      .mockResolvedValueOnce(pendingActivities)
      .mockResolvedValueOnce(updatedActivities);
    // First findMany: slot calculation; second findMany: batch-fetch existing item with activity
    (mockPrisma.itineraryItem.findMany as jest.Mock)
      .mockResolvedValueOnce([existingItineraryItem])
      .mockResolvedValueOnce([fullItem]);
    (mockPrisma.activity.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));

    const res = await POST(makeReq('trip-1'), { params: Promise.resolve({ id: 'trip-1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.itineraryItem.create).not.toHaveBeenCalled();
    expect(data.itineraryItems).toHaveLength(1);
  });
});

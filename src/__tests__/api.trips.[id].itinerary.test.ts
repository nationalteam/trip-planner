import { GET, POST } from '@/app/api/trips/[id]/itinerary/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
    },
    itineraryItem: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/llm', () => ({
  organizeItinerary: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { organizeItinerary } from '@/lib/llm';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockOrganizeItinerary = organizeItinerary as jest.Mock;

describe('GET /api/trips/[id]/itinerary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns itinerary items for a trip', async () => {
    const fakeItems = [
      {
        id: 'ii-1',
        tripId: 'trip-1',
        proposalId: 'p-1',
        day: 1,
        timeBlock: 'morning',
        proposal: { id: 'p-1', title: 'Eiffel Tower', description: 'Iconic', type: 'place', city: 'Paris', durationMinutes: 60, suggestedTime: 'morning' },
      },
    ];
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue(fakeItems);

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakeItems);
    expect(mockPrisma.itineraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: 'trip-1' } })
    );
  });

  it('returns an empty array when there are no itinerary items', async () => {
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
});

describe('POST /api/trips/[id]/itinerary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when trip does not exist', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/missing/itinerary', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'missing' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Trip not found');
  });

  it('returns empty array when itinerary has no items', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1' });
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
    expect(mockOrganizeItinerary).not.toHaveBeenCalled();
  });

  it('organizes itinerary and updates day/timeBlock', async () => {
    const existingItems = [
      {
        id: 'ii-1',
        tripId: 'trip-1',
        proposalId: 'p-1',
        day: 1,
        timeBlock: 'morning',
        proposal: { id: 'p-1', title: 'Eiffel', description: 'Iconic', type: 'place', city: 'Paris', durationMinutes: 60, suggestedTime: 'morning' },
      },
    ];
    const organized = [{ id: 'ii-1', day: 2, timeBlock: 'afternoon' }];
    const updatedItems = [{ id: 'ii-1', tripId: 'trip-1', proposalId: 'p-1', day: 2, timeBlock: 'afternoon' }];
    const updatedWithProposal = [
      {
        id: 'ii-1',
        tripId: 'trip-1',
        proposalId: 'p-1',
        day: 2,
        timeBlock: 'afternoon',
        proposal: { id: 'p-1', title: 'Eiffel', description: 'Iconic', type: 'place', city: 'Paris', durationMinutes: 60, suggestedTime: 'morning' },
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1' });
    (mockPrisma.itineraryItem.findMany as jest.Mock)
      .mockResolvedValueOnce(existingItems)
      .mockResolvedValueOnce(updatedWithProposal);
    mockOrganizeItinerary.mockResolvedValue(organized);
    (mockPrisma.itineraryItem.update as jest.Mock).mockResolvedValue(updatedItems[0]);
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue(updatedItems);

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(updatedWithProposal);
    expect(mockOrganizeItinerary).toHaveBeenCalledWith(existingItems);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 500 when LLM returns invalid itinerary mapping', async () => {
    const existingItems = [
      {
        id: 'ii-1',
        tripId: 'trip-1',
        proposalId: 'p-1',
        day: 1,
        timeBlock: 'morning',
        proposal: { id: 'p-1', title: 'Eiffel', description: 'Iconic', type: 'place', city: 'Paris', durationMinutes: 60, suggestedTime: 'morning' },
      },
    ];

    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue({ id: 'trip-1' });
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue(existingItems);
    mockOrganizeItinerary.mockResolvedValue([{ id: 'ii-1', day: -1, timeBlock: 'afternoon' }]);

    const req = new NextRequest('http://localhost/api/trips/trip-1/itinerary', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to organize itinerary');
  });
});

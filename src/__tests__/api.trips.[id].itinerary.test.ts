import { GET } from '@/app/api/trips/[id]/itinerary/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    itineraryItem: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

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

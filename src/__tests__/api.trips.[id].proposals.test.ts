import { GET, POST } from '@/app/api/trips/[id]/proposals/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    trip: {
      findUnique: jest.fn(),
    },
    preference: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/llm', () => ({
  generateProposals: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { generateProposals } from '@/lib/llm';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerate = generateProposals as jest.Mock;

describe('GET /api/trips/[id]/proposals', () => {
  it('returns proposals for a trip', async () => {
    const fakeProposals = [
      { id: 'p-1', tripId: 'trip-1', title: 'Eiffel Tower', status: 'pending' },
    ];
    (mockPrisma.proposal.findMany as jest.Mock).mockResolvedValue(fakeProposals);

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals');
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakeProposals);
  });
});

describe('POST /api/trips/[id]/proposals', () => {
  it('returns 404 when trip does not exist', async () => {
    (mockPrisma.trip.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/trips/bad-id/proposals', {
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

  it('generates and saves proposals when trip exists', async () => {
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
    (mockPrisma.preference.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.proposal.findMany as jest.Mock).mockResolvedValue([]);
    mockGenerate.mockResolvedValue(fakeGenerated);
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue(savedProposals);

    const req = new NextRequest('http://localhost/api/trips/trip-1/proposals', {
      method: 'POST',
      body: JSON.stringify({ city: 'Paris' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'trip-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(Array.isArray(data)).toBe(true);
    expect(mockGenerate).toHaveBeenCalledWith([], 'Paris', []);
  });
});

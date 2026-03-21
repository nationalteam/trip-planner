import { POST as approve } from '@/app/api/proposals/[id]/approve/route';
import { POST as reject } from '@/app/api/proposals/[id]/reject/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    proposal: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    itineraryItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const baseProposal = {
  id: 'p-1',
  tripId: 'trip-1',
  type: 'food',
  title: 'Le Bistro',
  description: 'Nice place',
  reason: 'Good food',
  lat: 48.86,
  lng: 2.33,
  city: 'Paris',
  suggestedTime: 'dinner',
  durationMinutes: 90,
  status: 'pending',
  itineraryItem: null,
  createdAt: new Date(),
};

describe('POST /api/proposals/[id]/approve', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when proposal does not exist', async () => {
    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/proposals/bad-id/approve', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'bad-id' }) };
    const res = await approve(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('approves the proposal and creates an itinerary item', async () => {
    const updatedProposal = { ...baseProposal, status: 'approved' };
    const newItineraryItem = { id: 'ii-1', tripId: 'trip-1', proposalId: 'p-1', day: 1, timeBlock: 'dinner' };
    const fullItineraryItem = { ...newItineraryItem, proposal: updatedProposal };

    (mockPrisma.proposal.findUnique as jest.Mock)
      .mockResolvedValueOnce(baseProposal)   // first call (initial lookup)
    ;
    (mockPrisma.proposal.update as jest.Mock).mockResolvedValue(updatedProposal);
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.itineraryItem.create as jest.Mock).mockResolvedValue(newItineraryItem);
    (mockPrisma.itineraryItem.findUnique as jest.Mock).mockResolvedValue(fullItineraryItem);

    const req = new NextRequest('http://localhost/api/proposals/p-1/approve', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'p-1' }) };
    const res = await approve(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.proposal.status).toBe('approved');
    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { status: 'approved' },
    });
    expect(mockPrisma.itineraryItem.create).toHaveBeenCalled();
  });

  it('does not create a duplicate itinerary item if one already exists', async () => {
    const existingItem = { id: 'ii-1', tripId: 'trip-1', proposalId: 'p-1', day: 1, timeBlock: 'dinner' };
    const proposalWithItem = { ...baseProposal, itineraryItem: existingItem };
    const updatedProposal = { ...baseProposal, status: 'approved' };
    const fullItem = { ...existingItem, proposal: updatedProposal };

    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(proposalWithItem);
    (mockPrisma.proposal.update as jest.Mock).mockResolvedValue(updatedProposal);
    (mockPrisma.itineraryItem.findUnique as jest.Mock).mockResolvedValue(fullItem);

    const req = new NextRequest('http://localhost/api/proposals/p-1/approve', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'p-1' }) };
    const res = await approve(req, context);

    expect(res.status).toBe(200);
    expect(mockPrisma.itineraryItem.create).not.toHaveBeenCalled();
  });

  it('schedules on the next available day when a time block is taken', async () => {
    const updatedProposal = { ...baseProposal, status: 'approved' };
    // Day 1 dinner is already taken
    const existingItems = [{ id: 'ii-0', tripId: 'trip-1', proposalId: 'other', day: 1, timeBlock: 'dinner' }];
    const newItem = { id: 'ii-1', tripId: 'trip-1', proposalId: 'p-1', day: 2, timeBlock: 'dinner' };
    const fullItem = { ...newItem, proposal: updatedProposal };

    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(baseProposal);
    (mockPrisma.proposal.update as jest.Mock).mockResolvedValue(updatedProposal);
    (mockPrisma.itineraryItem.findMany as jest.Mock).mockResolvedValue(existingItems);
    (mockPrisma.itineraryItem.create as jest.Mock).mockResolvedValue(newItem);
    (mockPrisma.itineraryItem.findUnique as jest.Mock).mockResolvedValue(fullItem);

    const req = new NextRequest('http://localhost/api/proposals/p-1/approve', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'p-1' }) };
    const res = await approve(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockPrisma.itineraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ day: 2, timeBlock: 'dinner' }) })
    );
    expect(data.itineraryItem.day).toBe(2);
  });
});

describe('POST /api/proposals/[id]/reject', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when proposal does not exist', async () => {
    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/proposals/bad-id/reject', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'bad-id' }) };
    const res = await reject(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('rejects the proposal and returns the updated proposal', async () => {
    const updatedProposal = { ...baseProposal, status: 'rejected' };
    (mockPrisma.proposal.findUnique as jest.Mock).mockResolvedValue(baseProposal);
    (mockPrisma.proposal.update as jest.Mock).mockResolvedValue(updatedProposal);

    const req = new NextRequest('http://localhost/api/proposals/p-1/reject', { method: 'POST' });
    const context = { params: Promise.resolve({ id: 'p-1' }) };
    const res = await reject(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('rejected');
    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { status: 'rejected' },
    });
  });
});

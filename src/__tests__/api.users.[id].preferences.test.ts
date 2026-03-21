import { GET, POST, PUT } from '@/app/api/users/[id]/preferences/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    preference: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/users/[id]/preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user preference when found', async () => {
    const fakePref = { id: 'pref-1', userId: 'u-1', likes: '["sushi"]', dislikes: '[]', budget: 'medium' };
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue(fakePref);

    const req = new NextRequest('http://localhost/api/users/u-1/preferences');
    const context = { params: Promise.resolve({ id: 'u-1' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakePref);
  });

  it('returns null when no preference exists', async () => {
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/users/u-99/preferences');
    const context = { params: Promise.resolve({ id: 'u-99' }) };
    const res = await GET(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toBeNull();
  });
});

describe('POST /api/users/[id]/preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a preference and returns 201', async () => {
    const newPref = { id: 'pref-2', userId: 'u-1', likes: '["pizza"]', dislikes: '["spicy"]', budget: 'low' };
    (mockPrisma.preference.create as jest.Mock).mockResolvedValue(newPref);

    const req = new NextRequest('http://localhost/api/users/u-1/preferences', {
      method: 'POST',
      body: JSON.stringify({ likes: ['pizza'], dislikes: ['spicy'], budget: 'low' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'u-1' }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual(newPref);
    expect(mockPrisma.preference.create).toHaveBeenCalledWith({
      data: {
        userId: 'u-1',
        likes: JSON.stringify(['pizza']),
        dislikes: JSON.stringify(['spicy']),
        budget: 'low',
      },
    });
  });
});

describe('PUT /api/users/[id]/preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when preference does not exist', async () => {
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/users/u-99/preferences', {
      method: 'PUT',
      body: JSON.stringify({ likes: [], dislikes: [], budget: null }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'u-99' }) };
    const res = await PUT(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('updates an existing preference', async () => {
    const existing = { id: 'pref-1', userId: 'u-1', likes: '["sushi"]', dislikes: '[]', budget: null };
    const updated = { ...existing, likes: '["pizza","sushi"]', budget: 'high' };
    (mockPrisma.preference.findFirst as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.preference.update as jest.Mock).mockResolvedValue(updated);

    const req = new NextRequest('http://localhost/api/users/u-1/preferences', {
      method: 'PUT',
      body: JSON.stringify({ likes: ['pizza', 'sushi'], dislikes: [], budget: 'high' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context = { params: Promise.resolve({ id: 'u-1' }) };
    const res = await PUT(req, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.likes).toBe('["pizza","sushi"]');
    expect(mockPrisma.preference.update).toHaveBeenCalledWith({
      where: { id: 'pref-1' },
      data: {
        likes: JSON.stringify(['pizza', 'sushi']),
        dislikes: JSON.stringify([]),
        budget: 'high',
      },
    });
  });
});

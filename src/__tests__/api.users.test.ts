import { GET, POST } from '@/app/api/users/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/users', () => {
  it('returns a list of users', async () => {
    const fakeUsers = [
      { id: 'u-1', name: 'Alice' },
      { id: 'u-2', name: 'Bob' },
    ];
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(fakeUsers);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(fakeUsers);
  });
});

describe('POST /api/users', () => {
  it('creates a user and returns 201', async () => {
    const newUser = { id: 'u-3', name: 'Charlie' };
    (mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Charlie' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe('Charlie');
    expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: { name: 'Charlie' } });
  });
});

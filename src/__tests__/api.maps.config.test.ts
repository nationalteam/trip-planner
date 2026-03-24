import { GET } from '@/app/api/maps/config/route';
import { requireAuth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}));

const mockRequireAuth = requireAuth as jest.Mock;

describe('/api/maps/config', () => {
  const originalServerKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: 'u-1', email: 'u1@example.com', name: 'U1' });
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterAll(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalServerKey;
  });

  it('returns GOOGLE_MAPS_API_KEY when available', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'server-key';

    const res = await GET(new NextRequest('http://localhost/api/maps/config'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ apiKey: 'server-key' });
  });

  it('returns null key when no key is configured', async () => {
    const res = await GET(new NextRequest('http://localhost/api/maps/config'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ apiKey: null });
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await GET(new NextRequest('http://localhost/api/maps/config'));
    expect(res.status).toBe(401);
  });
});

import { GET, POST } from '@/app/api/users/route';

describe('GET /api/users', () => {
  it('returns 410 for deprecated endpoint', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.error).toMatch(/deprecated/i);
  });
});

describe('POST /api/users', () => {
  it('returns 410 for deprecated endpoint', async () => {
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.error).toMatch(/deprecated/i);
  });
});

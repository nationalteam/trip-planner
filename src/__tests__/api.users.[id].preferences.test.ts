import { GET, POST, PUT } from '@/app/api/users/[id]/preferences/route';

describe('GET /api/users/[id]/preferences', () => {
  it('returns 410 for deprecated endpoint', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.error).toMatch(/deprecated/i);
  });
});

describe('POST /api/users/[id]/preferences', () => {
  it('returns 410 for deprecated endpoint', async () => {
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.error).toMatch(/deprecated/i);
  });
});

describe('PUT /api/users/[id]/preferences', () => {
  it('returns 410 for deprecated endpoint', async () => {
    const res = await PUT();
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.error).toMatch(/deprecated/i);
  });
});

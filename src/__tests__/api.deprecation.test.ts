import { NextRequest } from 'next/server';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

describe('withProposalDeprecationHeaders', () => {
  it('adds deprecation headers for legacy proposals routes', () => {
    const req = new NextRequest('http://localhost/api/proposals/p-1/approve', { method: 'POST' });
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const decorated = withProposalDeprecationHeaders(req, res);

    expect(decorated.headers.get('Deprecation')).toBe('true');
    expect(decorated.headers.get('Link')).toContain('/api/activities/p-1/approve');
    expect(decorated.headers.get('Sunset')).toBe('Tue, 30 Jun 2026 23:59:59 GMT');
    expect(decorated.headers.get('X-Legacy-Endpoint')).toBe('proposals');
  });

  it('does not add deprecation headers for activities routes', () => {
    const req = new NextRequest('http://localhost/api/activities/p-1/approve', { method: 'POST' });
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const decorated = withProposalDeprecationHeaders(req, res);

    expect(decorated.headers.get('Deprecation')).toBeNull();
    expect(decorated.headers.get('Link')).toBeNull();
  });
});

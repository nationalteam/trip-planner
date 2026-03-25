import { NextRequest } from 'next/server';
import { withProposalDeprecationHeaders } from '@/lib/api-deprecation';

describe('withProposalDeprecationHeaders', () => {
  it.each([
    ['/api/proposals/p-1', '/api/activities/p-1'],
    ['/api/proposals/p-1/approve', '/api/activities/p-1/approve'],
    ['/api/proposals/p-1/reject', '/api/activities/p-1/reject'],
    ['/api/trips/t-1/proposals', '/api/trips/t-1/activities'],
    ['/api/trips/t-1/proposals/fill', '/api/trips/t-1/activities/fill'],
  ])('adds full deprecation headers for legacy route %s', (legacyPath, successorPath) => {
    const req = new NextRequest(`http://localhost${legacyPath}`, { method: 'POST' });
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const decorated = withProposalDeprecationHeaders(req, res);

    expect(decorated.headers.get('Deprecation')).toBe('true');
    expect(decorated.headers.get('Link')).toBe(`<http://localhost${successorPath}>; rel="successor-version"`);
    expect(decorated.headers.get('Sunset')).toBe('Tue, 30 Jun 2026 23:59:59 GMT');
    expect(decorated.headers.get('X-Legacy-Endpoint')).toBe('proposals');
    expect(decorated.headers.get('Warning')).toContain('Deprecated API');
  });

  it('does not add deprecation headers for activities routes', () => {
    const req = new NextRequest('http://localhost/api/activities/p-1/approve', { method: 'POST' });
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const decorated = withProposalDeprecationHeaders(req, res);

    expect(decorated.headers.get('Deprecation')).toBeNull();
    expect(decorated.headers.get('Link')).toBeNull();
    expect(decorated.headers.get('Sunset')).toBeNull();
    expect(decorated.headers.get('X-Legacy-Endpoint')).toBeNull();
  });
});

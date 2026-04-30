import { GET } from '@/app/api/weather/route';
import { NextRequest } from 'next/server';

const mockFetch = jest.fn();

global.fetch = mockFetch;

describe('GET /api/weather', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when city is missing', async () => {
    const req = new NextRequest('http://localhost/api/weather');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when city is empty', async () => {
    const req = new NextRequest('http://localhost/api/weather?city=');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns forecasts for valid city', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ latitude: 48.85, longitude: 2.35 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          daily: {
            time: ['2024-06-01', '2024-06-02'],
            weathercode: [0, 1],
            temperature_2m_max: [25, 22],
            temperature_2m_min: [18, 15],
          },
        }),
      });

    const req = new NextRequest('http://localhost/api/weather?city=Paris&startDate=2024-06-01&days=2');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json() as { forecasts: { date: string; temp_max: number; emoji: string }[] };
    expect(data.forecasts).toHaveLength(2);
    expect(data.forecasts[0].date).toBe('2024-06-01');
    expect(data.forecasts[0].temp_max).toBe(25);
    expect(data.forecasts[0].emoji).toBe('☀️');
    expect(data.forecasts[1].emoji).toBe('🌤️');
  });

  it('returns empty forecasts when city is not geocoded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const req = new NextRequest('http://localhost/api/weather?city=UnknownCity123');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json() as { forecasts: unknown[] };
    expect(data.forecasts).toHaveLength(0);
  });

  it('returns 502 when geocoding fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const req = new NextRequest('http://localhost/api/weather?city=Paris');
    const res = await GET(req);
    expect(res.status).toBe(502);
  });
});

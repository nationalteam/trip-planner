import { NextRequest, NextResponse } from 'next/server';
import { isValidDateOnly } from '@/lib/dates';

const WEATHER_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear sky', emoji: '☀️' },
  1: { label: 'Mainly clear', emoji: '🌤️' },
  2: { label: 'Partly cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁️' },
  45: { label: 'Fog', emoji: '🌫️' },
  48: { label: 'Icy fog', emoji: '🌫️' },
  51: { label: 'Light drizzle', emoji: '🌦️' },
  53: { label: 'Drizzle', emoji: '🌦️' },
  55: { label: 'Heavy drizzle', emoji: '🌦️' },
  61: { label: 'Light rain', emoji: '🌧️' },
  63: { label: 'Rain', emoji: '🌧️' },
  65: { label: 'Heavy rain', emoji: '🌧️' },
  71: { label: 'Light snow', emoji: '❄️' },
  73: { label: 'Snow', emoji: '❄️' },
  75: { label: 'Heavy snow', emoji: '❄️' },
  77: { label: 'Snow grains', emoji: '❄️' },
  80: { label: 'Light showers', emoji: '🌧️' },
  81: { label: 'Showers', emoji: '🌧️' },
  82: { label: 'Heavy showers', emoji: '🌧️' },
  85: { label: 'Snow showers', emoji: '🌨️' },
  86: { label: 'Heavy snow showers', emoji: '🌨️' },
  95: { label: 'Thunderstorm', emoji: '⛈️' },
  96: { label: 'Thunderstorm w/ hail', emoji: '⛈️' },
  99: { label: 'Thunderstorm w/ heavy hail', emoji: '⛈️' },
};

function getWeatherInfo(code: number): { label: string; emoji: string } {
  return WEATHER_CODES[code] ?? { label: 'Unknown', emoji: '🌡️' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const city = searchParams.get('city');
  const startDateRaw = searchParams.get('startDate');
  const daysParam = searchParams.get('days');
  // Treat blank/empty startDate as not provided
  const startDate = startDateRaw?.trim() || null;

  if (!city || typeof city !== 'string' || !city.trim()) {
    return NextResponse.json({ error: 'Missing city parameter' }, { status: 400 });
  }

  if (startDate && !isValidDateOnly(startDate)) {
    return NextResponse.json({ error: 'Invalid startDate. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  const days = Math.min(Math.max(parseInt(daysParam ?? '7', 10) || 7, 1), 16);

  try {
    // Geocode the city
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`;
    const geocodeRes = await fetch(geocodeUrl, { next: { revalidate: 3600 } });
    if (!geocodeRes.ok) {
      return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 });
    }
    const geocodeData = await geocodeRes.json() as { results?: { latitude: number; longitude: number }[] };
    const location = geocodeData.results?.[0];
    if (!location) {
      return NextResponse.json({ forecasts: [] });
    }

    const { latitude, longitude } = location;

    // Build date range
    const start = startDate ?? new Date().toISOString().slice(0, 10);
    const endDateObj = new Date(start + 'T00:00:00Z');
    endDateObj.setUTCDate(endDateObj.getUTCDate() + days - 1);
    const end = endDateObj.toISOString().slice(0, 10);

    // Fetch forecast
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=UTC&start_date=${start}&end_date=${end}`;
    const forecastRes = await fetch(forecastUrl, { next: { revalidate: 3600 } });
    if (!forecastRes.ok) {
      return NextResponse.json({ error: 'Forecast fetch failed' }, { status: 502 });
    }
    const forecastData = await forecastRes.json() as {
      daily?: {
        time: string[];
        weathercode: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
      };
    };

    const daily = forecastData.daily;
    if (!daily) {
      return NextResponse.json({ forecasts: [] });
    }

    const forecasts = daily.time.map((date, i) => ({
      date,
      weathercode: daily.weathercode[i],
      temp_max: Math.round(daily.temperature_2m_max[i]),
      temp_min: Math.round(daily.temperature_2m_min[i]),
      emoji: getWeatherInfo(daily.weathercode[i]).emoji,
      label: getWeatherInfo(daily.weathercode[i]).label,
    }));

    return NextResponse.json({ forecasts }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 502 });
  }
}

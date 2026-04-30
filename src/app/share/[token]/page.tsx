'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { compareItineraryTimeBlock } from '@/lib/time-block';
import { buildMapActivities } from '@/lib/map-activities';

const ItineraryView = dynamic(() => import('@/components/ItineraryView'), { ssr: false });
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  reason: string;
  lat: number;
  lng: number;
  city: string;
  suggestedTime: string;
  durationMinutes: number | null;
  status: string;
}

interface ItineraryItem {
  id: string;
  day: number;
  timeBlock: string;
  order: number;
  activity: Activity;
}

interface Trip {
  id: string;
  name: string;
  cities: string;
  startDate?: string | null;
  durationDays?: number | null;
  itineraryVisibleDays?: number | null;
  activities: Activity[];
  itineraryItems: ItineraryItem[];
}

interface WeatherDay {
  date: string;
  weathercode: number;
  temp_max: number;
  temp_min: number;
  emoji: string;
  label: string;
}

type Tab = 'itinerary' | 'activities' | 'map';

export default function SharePage() {
  const { token } = useParams() as { token: string };
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('itinerary');
  const [weatherByDay, setWeatherByDay] = useState<Record<number, WeatherDay>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('approved');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/trips/${token}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) { setFetchError(true); return null; }
        return res.json();
      })
      .then(data => {
        if (data) setTrip(data as Trip);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!trip?.startDate || !trip.cities) return;
    const cities: string[] = JSON.parse(trip.cities);
    if (!cities.length) return;
    const primaryCity = cities[0];
    const days = Math.max(trip.durationDays ?? 7, 7);

    fetch(`/api/weather?city=${encodeURIComponent(primaryCity)}&startDate=${trip.startDate}&days=${days}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.forecasts || !trip.startDate) return;
        const startDateObj = new Date(trip.startDate + 'T00:00:00Z');
        const byDay: Record<number, WeatherDay> = {};
        (data.forecasts as WeatherDay[]).forEach(f => {
          const fDate = new Date(f.date + 'T00:00:00Z');
          const diffDays = Math.round((fDate.getTime() - startDateObj.getTime()) / 86400000);
          const day = diffDays + 1;
          if (day >= 1) byDay[day] = f;
        });
        setWeatherByDay(byDay);
      })
      .catch(() => {});
  }, [trip]);

  const itinerary: ItineraryItem[] = useMemo(() => {
    if (!trip?.itineraryItems) return [];
    return [...trip.itineraryItems].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      const tbCmp = compareItineraryTimeBlock(a.timeBlock, b.timeBlock);
      if (tbCmp !== 0) return tbCmp;
      return a.order - b.order;
    });
  }, [trip]);

  const activities: Activity[] = useMemo(() => trip?.activities ?? [], [trip]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activities.filter(a => {
      const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
      const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.city.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [activities, filterStatus, searchQuery]);

  const mapActivities = useMemo(() => buildMapActivities(activities, itinerary), [activities, itinerary]);

  const itineraryRoute = useMemo(() => {
    return itinerary.map(item => ({
      activityId: item.activity.id,
      day: item.day,
      lat: item.activity.lat,
      lng: item.activity.lng,
    }));
  }, [itinerary]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 spinner-gradient"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h1>
        <p className="text-gray-500">Could not load this trip. Please try again later.</p>
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Link not found</h1>
        <p className="text-gray-500">This trip share link has expired or been removed.</p>
      </div>
    );
  }

  const cities: string[] = JSON.parse(trip.cities);
  const typeIcons: Record<string, string> = { food: '🍽️', place: '🏛️', hotel: '🏨' };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full font-medium mb-3">
          🔗 Shared trip · read-only
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{trip.name}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {cities.map(city => (
            <span key={city} className="bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
              📍 {city}
            </span>
          ))}
        </div>
        {(trip.startDate || trip.durationDays) && (
          <p className="text-sm text-gray-500 mt-2">
            {[trip.startDate ? `Start ${trip.startDate}` : null, trip.durationDays ? `${trip.durationDays} days` : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl mb-6 w-fit backdrop-blur-sm shadow-sm">
        {(['itinerary', 'activities', 'map'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
          >
            {tab === 'itinerary' ? '📋 Itinerary' : tab === 'activities' ? '💡 Activities' : '🗺️ Map'}
          </button>
        ))}
      </div>

      {/* Itinerary tab */}
      {activeTab === 'itinerary' && (
        <ItineraryView
          items={itinerary}
          schedule={{ startDate: trip.startDate, durationDays: trip.durationDays, itineraryVisibleDays: trip.itineraryVisibleDays }}
          weatherByDay={weatherByDay}
        />
      )}

      {/* Activities tab */}
      {activeTab === 'activities' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search activities..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-1">
              {['all', 'approved'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">No activities found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActivities.map(a => (
                <div key={a.id} className="rounded-xl border p-5 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{typeIcons[a.type] || '📌'}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      <p className="text-xs text-gray-500">{a.city}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{a.description}</p>
                  {a.durationMinutes && (
                    <p className="text-xs text-gray-400 mt-2">⏱ ~{a.durationMinutes} min</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map tab */}
      {activeTab === 'map' && (
        mapActivities.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
            <div className="text-5xl mb-3">🗺️</div>
            <p className="text-gray-500">No activities on map yet</p>
          </div>
        ) : (
          <MapView
            activities={mapActivities}
            itineraryRoute={itineraryRoute}
            showItineraryRoute={itinerary.length > 0}
            itineraryDayFilter="all"
          />
        )
      )}
    </div>
  );
}

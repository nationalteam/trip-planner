'use client';

import { useState, useEffect } from 'react';
import TripCard from '@/components/TripCard';

interface Trip {
  id: string;
  name: string;
  cities: string;
  createdAt: string;
  startDate?: string | null;
  durationDays?: number | null;
  counts?: {
    activitiesCount: number;
    itineraryItemsCount: number;
  };
}

interface TripApiResponse {
  id: string;
  name: string;
  cities: string;
  createdAt: string;
  startDate?: string | null;
  durationDays?: number | null;
  _count?: { activities: number; itineraryItems: number };
}

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [citiesInput, setCitiesInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [durationDaysInput, setDurationDaysInput] = useState('');

  useEffect(() => {
    fetchTrips();
  }, []);

  async function fetchTrips() {
    try {
      const res = await fetch('/api/trips');
      if (res.status === 401) {
        window.location.href = '/auth';
        return;
      }
      const data: unknown = await res.json();
      const normalizedTrips = Array.isArray(data)
        ? (data as TripApiResponse[]).map((trip) => ({
          id: trip.id,
          name: trip.name,
          cities: trip.cities,
          createdAt: trip.createdAt,
          startDate: trip.startDate ?? null,
          durationDays: trip.durationDays ?? null,
          counts: trip._count
            ? {
              activitiesCount: trip._count.activities,
              itineraryItemsCount: trip._count.itineraryItems,
            }
            : undefined,
        }))
        : [];
      setTrips(normalizedTrips);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const cities = citiesInput.split(',').map(c => c.trim()).filter(Boolean);
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          cities,
          startDate: startDateInput || null,
          durationDays: durationDaysInput ? Number(durationDaysInput) : null,
        }),
      });
      if (res.ok) {
        const trip = await res.json();
        setTrips(prev => [trip, ...prev]);
        setName('');
        setCitiesInput('');
        setStartDateInput('');
        setDurationDaysInput('');
        setShowForm(false);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
          <p className="text-gray-500 mt-1">Plan your next adventure with AI-powered suggestions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
        >
          + New Trip
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Create a New Trip</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. European Summer 2024"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cities (comma separated)</label>
              <input
                type="text"
                value={citiesInput}
                onChange={e => setCitiesInput(e.target.value)}
                placeholder="e.g. Paris, Rome, Barcelona"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (optional)</label>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={e => setStartDateInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration Days (optional)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={durationDaysInput}
                  onChange={e => setDurationDaysInput(e.target.value)}
                  placeholder="e.g. 7"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {creating ? 'Creating...' : 'Create Trip'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No trips yet</h3>
          <p className="text-gray-500 mb-6">Create your first trip to get started</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Your First Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

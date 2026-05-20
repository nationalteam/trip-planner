'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TripCard from '@/components/TripCard';
import { summarizePortfolioPriority } from '@/lib/portfolio-priority';

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

const workflow = [
  { title: 'Curated discovery', text: 'Select destination-defining stays, tables, culture, and private-feeling moments.' },
  { title: 'Concierge-grade itinerary craft', text: 'Shape each day with pacing, meal anchors, transfers, and restorative downtime.' },
  { title: 'Map-ready routes', text: 'See arranged and unarranged places spatially so every day feels effortless.' },
];

const atelierStandards = [
  { title: 'Signature pace', text: 'Balance marquee sights with unhurried transitions, rest windows, and room for serendipity.' },
  { title: 'Table-first planning', text: 'Anchor each day around dining moments, neighborhood rhythm, and reservation realities.' },
  { title: 'Quiet logistics', text: 'Surface map context, schedule fit, and share-ready clarity without overwhelming the traveler.' },
];

export default function Home() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [citiesInput, setCitiesInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [durationDaysInput, setDurationDaysInput] = useState('');

  const fetchTrips = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

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
        router.push(`/trips/${trip.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  const totalActivities = trips.reduce((sum, trip) => sum + (trip.counts?.activitiesCount ?? 0), 0);
  const plannedItems = trips.reduce((sum, trip) => sum + (trip.counts?.itineraryItemsCount ?? 0), 0);
  const portfolioPriority = summarizePortfolioPriority(trips);

  return (
    <div className="relative overflow-hidden bg-[#f7f1e8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,_rgba(180,130,60,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(15,23,42,0.18),_transparent_34%),linear-gradient(180deg,_#fbf7ef_0%,_#fffaf2_70%,_#ffffff_100%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-amber-300/70 bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-amber-800 shadow-sm">
              Boutique luxury travel atelier
            </p>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              Design journeys with expert-level clarity
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Build a polished travel dossier with the discipline of a private concierge: destination intelligence, refined activity curation, graceful pacing, maps, sharing, and AI-assisted refinement in one workspace.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="rounded-full bg-[#1f1710] px-6 py-3 text-sm font-bold text-amber-50 shadow-xl shadow-amber-900/20 transition-all hover:-translate-y-0.5 hover:bg-[#352719]"
              >
                + New Trip
              </button>
              <a href="#my-trips" className="rounded-full border border-amber-200 bg-white/85 px-6 py-3 text-sm font-bold text-stone-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:text-amber-800">
                View my portfolio
              </a>
            </div>
            <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/70">
                <p className="text-2xl font-black text-slate-950">{trips.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trips</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/70">
                <p className="text-2xl font-black text-slate-950">{totalActivities}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ideas</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200/70">
                <p className="text-2xl font-black text-slate-950">{plannedItems}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planned</p>
              </div>
            </div>

            {portfolioPriority && (
              <div className="mt-5 max-w-2xl rounded-[1.75rem] border border-amber-200 bg-white/88 p-5 shadow-xl shadow-amber-900/10 backdrop-blur">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Concierge next move</p>
                    <h2 className="mt-2 text-xl font-black text-stone-950">{portfolioPriority.label}</h2>
                    <p className="mt-1 text-sm font-bold text-stone-500">{portfolioPriority.tripName}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{portfolioPriority.detail}</p>
                  </div>
                  <Link
                    href={`/trips/${portfolioPriority.tripId}`}
                    className="inline-flex shrink-0 justify-center rounded-full bg-[#1f1710] px-4 py-2 text-sm font-black text-amber-50 shadow-sm transition hover:bg-[#352719]"
                  >
                    {portfolioPriority.actionLabel}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-amber-100 bg-white/80 p-4 shadow-2xl shadow-amber-900/10 backdrop-blur">
            <div className="overflow-hidden rounded-[1.5rem] bg-[#17120d] text-amber-50">
              <div className="bg-[linear-gradient(135deg,_rgba(31,23,16,0.96),_rgba(146,100,38,0.82)),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22%3E%3Cg fill=%22none%22 stroke=%22white%22 stroke-opacity=%220.12%22%3E%3Cpath d=%22M0 40h120M0 80h120M40 0v120M80 0v120%22/%3E%3C/g%3E%3C/svg%3E')] p-6">
                <div className="mb-20 flex items-center justify-between">
                  <span className="rounded-full bg-amber-50/15 px-3 py-1 text-xs font-bold backdrop-blur">Private itinerary board</span>
                  <span className="text-3xl">🌍</span>
                </div>
                <h2 className="text-2xl font-black">Tokyo design retreat</h2>
                <p className="mt-2 text-sm text-amber-50/90">Kissaten calm → ateliers → omakase evening</p>
              </div>
              <div className="grid gap-3 bg-white p-5 text-slate-900">
                {workflow.map((item, index) => (
                  <div key={item.title} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1f1710] text-sm font-black text-amber-50">{index + 1}</span>
                    <div>
                      <h3 className="font-black text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-amber-100 bg-white/80 p-5 shadow-xl shadow-amber-900/10 backdrop-blur sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Atelier standards</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">Concierge craft rules behind every trip</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-stone-500">Built as a practical planning desk: tasteful enough for luxury travel, explicit enough for real execution.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {atelierStandards.map((standard) => (
              <article key={standard.title} className="rounded-3xl border border-amber-100 bg-[#fffaf2] p-5 shadow-sm">
                <h3 className="text-lg font-black text-stone-950">{standard.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{standard.text}</p>
              </article>
            ))}
          </div>
        </section>

        {showForm && (
          <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-100">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">Private trip brief</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Create a New Trip</h2>
                <p className="mt-1 text-sm text-slate-500">Start with the core constraints. You can refine preferences, activities, and route details later.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-500 hover:bg-slate-50">
                Close
              </button>
            </div>
            <form onSubmit={handleCreate} className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label htmlFor="trip-name" className="block text-sm font-bold text-slate-700 mb-1">Trip Name</label>
                <input
                  id="trip-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. European Summer 2024"
                  required
                  className="w-full rounded-2xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
              <div className="lg:col-span-3">
                <label htmlFor="trip-cities" className="block text-sm font-bold text-slate-700 mb-1">Cities (comma separated)</label>
                <input
                  id="trip-cities"
                  type="text"
                  value={citiesInput}
                  onChange={e => setCitiesInput(e.target.value)}
                  placeholder="e.g. Paris, Rome, Barcelona"
                  required
                  className="w-full rounded-2xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="trip-start-date" className="block text-sm font-bold text-slate-700 mb-1">Start Date (optional)</label>
                <input
                  id="trip-start-date"
                  type="date"
                  value={startDateInput}
                  onChange={e => setStartDateInput(e.target.value)}
                  className="w-full rounded-2xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="trip-duration-days" className="block text-sm font-bold text-slate-700 mb-1">Duration Days (optional)</label>
                <input
                  id="trip-duration-days"
                  type="number"
                  min={1}
                  step={1}
                  value={durationDaysInput}
                  onChange={e => setDurationDaysInput(e.target.value)}
                  placeholder="e.g. 7"
                  className="w-full rounded-2xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
              <div className="flex items-end lg:col-span-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full rounded-2xl bg-[#1f1710] px-5 py-3 font-bold text-amber-50 shadow-lg shadow-amber-900/20 transition hover:bg-[#352719] disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section id="my-trips" className="mt-12">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Portfolio</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">My Trips</h2>
              <p className="mt-1 text-slate-500">A private-feeling portfolio for every destination you are shaping.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="rounded-full border border-amber-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-800 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
            >
              + Add itinerary
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 spinner-gradient"></div>
            </div>
          ) : trips.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center shadow-sm">
              <div className="text-6xl mb-4">🗺️</div>
              <h3 className="text-xl font-black text-slate-800 mb-2">No trips yet</h3>
              <p className="mx-auto mb-6 max-w-md text-slate-500">Create your first trip to turn loose inspiration into a boutique, shareable travel dossier.</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="rounded-full bg-[#1f1710] px-6 py-3 font-bold text-amber-50 shadow-lg shadow-amber-900/20 transition hover:bg-[#352719]"
              >
                Create Your First Trip
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {trips.map(trip => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

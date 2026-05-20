'use client';

import Link from 'next/link';
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

interface TripCardProps {
  trip: Trip;
}

function safeParseCities(citiesJson: string): string[] {
  try {
    const cities = JSON.parse(citiesJson) as unknown;
    return Array.isArray(cities) ? cities.filter((city): city is string => typeof city === 'string') : [];
  } catch {
    return [];
  }
}

export default function TripCard({ trip }: TripCardProps) {
  const cities = safeParseCities(trip.cities);
  const date = new Date(trip.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const plannedPercent = trip.counts && trip.counts.activitiesCount > 0
    ? Math.round((trip.counts.itineraryItemsCount / trip.counts.activitiesCount) * 100)
    : 0;
  const nextMove = summarizePortfolioPriority([trip]);

  return (
    <Link href={`/trips/${trip.id}`} className="group block h-full">
      <article className="relative h-full overflow-hidden rounded-[1.75rem] border border-amber-200/70 bg-[#fffaf2] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-900/10">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-amber-100 via-stone-50 to-[#f8ead4]" />
        <div className="relative p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.26em] text-amber-800">Private dossier</p>
              <h3 className="text-xl font-black tracking-tight text-stone-950 transition-colors group-hover:text-amber-800">
                {trip.name}
              </h3>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1f1710] text-2xl shadow-sm ring-1 ring-amber-200 transition-transform group-hover:rotate-6 group-hover:scale-110">
              ✈️
            </span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {cities.map(city => (
              <span key={city} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                📍 {city}
              </span>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 text-sm">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Created</p>
              <p className="mt-1 font-bold text-slate-800">{date}</p>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Schedule</p>
              <p className="mt-1 font-bold text-slate-800">
                {trip.durationDays ? `${trip.durationDays}-day plan` : 'Open schedule'}
              </p>
            </div>
          </div>

          {nextMove && (
            <div className="mb-5 rounded-2xl border border-amber-100 bg-white/75 p-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-800">Next move</p>
              <p className="mt-1 text-sm font-black text-stone-950">{nextMove.label}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{nextMove.detail}</p>
            </div>
          )}

          <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 text-xs">
                {trip.startDate ? <span>Start {trip.startDate}</span> : <span>Flexible schedule</span>}
                {trip.durationDays ? <span>{trip.durationDays} days</span> : null}
              </div>
              {trip.counts && (
                <div className="mt-2 flex gap-3 text-xs font-semibold text-slate-600">
                  <span>{trip.counts.activitiesCount} activities</span>
                  <span>{trip.counts.itineraryItemsCount} planned</span>
                </div>
              )}
            </div>
            {trip.counts && (
              <div className="text-right">
                <p className="text-lg font-black text-slate-950">{plannedPercent}% planned</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Concierge score</p>
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

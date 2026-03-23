'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ProposalCard from '@/components/ProposalCard';
import ItineraryView from '@/components/ItineraryView';
import ConfirmDialog from '@/components/ConfirmDialog';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

interface Trip {
  id: string;
  name: string;
  cities: string;
  createdAt: string;
  startDate?: string | null;
  durationDays?: number | null;
  currentRole?: 'owner' | 'viewer';
}

interface Proposal {
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
  proposal: Proposal;
}

type Tab = 'proposals' | 'itinerary' | 'map';

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('proposals');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'title' | 'city' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualType, setManualType] = useState('place');
  const [manualSuggestedTime, setManualSuggestedTime] = useState('afternoon');
  const [manualDurationMinutes, setManualDurationMinutes] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [creatingManual, setCreatingManual] = useState(false);
  const [fillingDetails, setFillingDetails] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [tripRes, proposalsRes, itineraryRes] = await Promise.all([
        fetch(`/api/trips/${tripId}`),
        fetch(`/api/trips/${tripId}/proposals?sortBy=${sortBy}&order=${sortOrder}`),
        fetch(`/api/trips/${tripId}/itinerary`),
      ]);
      const [tripData, proposalsData, itineraryData] = await Promise.all([
        tripRes.json(),
        proposalsRes.json(),
        itineraryRes.json(),
      ]);
      setTrip(tripData);
      setProposals(proposalsData);
      setItinerary(itineraryData);
      if (tripData?.cities) {
        const cities = JSON.parse(tripData.cities);
        if (cities.length > 0) setSelectedCity(cities[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, sortBy, sortOrder]);

  useEffect(() => {
    if (tripId) {
      fetchAll();
    }
  }, [tripId, fetchAll]);

  useEffect(() => {
    if (!manualCity && selectedCity) {
      setManualCity(selectedCity);
    }
  }, [selectedCity, manualCity]);

  async function handleGenerate() {
    if (!selectedCity) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: selectedCity }),
      });
      if (res.ok) {
        const newProposals = await res.json();
        setProposals(prev => [...newProposals, ...prev]);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateManualProposal(e: React.FormEvent) {
    e.preventDefault();
    setCreatingManual(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          title: manualTitle,
          description: manualDescription,
          city: manualCity || selectedCity,
          type: manualType,
          suggestedTime: manualSuggestedTime,
          durationMinutes: manualDurationMinutes ? Number(manualDurationMinutes) : null,
          lat: manualLat ? Number(manualLat) : null,
          lng: manualLng ? Number(manualLng) : null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setProposals(prev => [created, ...prev]);
        setManualTitle('');
        setManualDescription('');
        setManualDurationMinutes('');
        setManualLat('');
        setManualLng('');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to create proposal. Please check the form and try again.');
      }
    } finally {
      setCreatingManual(false);
    }
  }

  async function handleFillWithAI() {
    const city = manualCity || selectedCity;
    if (!manualTitle || !city) return;
    setFillingDetails(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/proposals/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: manualTitle, city }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.description) setManualDescription(data.description);
        if (data.type) setManualType(data.type);
        if (data.suggestedTime) setManualSuggestedTime(data.suggestedTime);
        if (data.durationMinutes) setManualDurationMinutes(String(data.durationMinutes));
        if (data.lat != null) setManualLat(String(data.lat));
        if (data.lng != null) setManualLng(String(data.lng));
      }
    } finally {
      setFillingDetails(false);
    }
  }

  async function handleApprove(proposalId: string) {
    const res = await fetch(`/api/proposals/${proposalId}/approve`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'approved' } : p));
      if (data.itineraryItem) {
        setItinerary(prev => [...prev, data.itineraryItem]);
      }
    }
  }

  async function handleReject(proposalId: string) {
    const res = await fetch(`/api/proposals/${proposalId}/reject`, { method: 'POST' });
    if (res.ok) {
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'rejected' } : p));
    }
  }

  async function handleOrganizeItinerary() {
    setOrganizing(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary`, { method: 'POST' });
      if (res.ok) {
        const organized = await res.json();
        setItinerary(organized);
      }
    } finally {
      setOrganizing(false);
    }
  }

  async function handleReorderItinerary(updates: { id: string; day: number; timeBlock: string; order: number }[]) {
    // Optimistically apply the reorder to the local state
    const updatesById = new Map(updates.map(u => [u.id, u]));
    const reordered = [...itinerary]
      .map(item => {
        const u = updatesById.get(item.id);
        return u ? { ...item, day: u.day, timeBlock: u.timeBlock, order: u.order } : item;
      })
      .sort((a, b) => a.order - b.order);
    setItinerary(reordered);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        // Revert on API error
        fetchAll();
      }
    } catch {
      // Revert on network error
      fetchAll();
    }
  }

  async function handleDeleteTrip() {
    setConfirmDialog({
      message: 'Delete this trip? All proposals and itinerary items will be permanently removed.',
      onConfirm: async () => {
        setConfirmDialog(null);
        const res = await fetch(`/api/trips/${tripId}`, { method: 'DELETE' });
        if (res.ok) {
          router.push('/');
        } else {
          alert('Failed to delete trip. Please try again.');
        }
      },
    });
  }

  async function handleDeleteProposal(proposalId: string) {
    setConfirmDialog({
      message: 'Delete this proposal? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        const res = await fetch(`/api/proposals/${proposalId}`, { method: 'DELETE' });
        if (res.ok) {
          setProposals(prev => prev.filter(p => p.id !== proposalId));
          setItinerary(prev => prev.filter(item => item.proposal.id !== proposalId));
        } else {
          alert('Failed to delete proposal. Please try again.');
        }
      },
    });
  }

  async function handleShareTrip(e: React.FormEvent) {
    e.preventDefault();
    setSharing(true);
    setShareMessage('');
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShareMessage(`Shared with ${data.user?.email || shareEmail}`);
        setShareEmail('');
      } else {
        setShareMessage(data.error || 'Failed to share trip');
      }
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 text-lg">Trip not found</p>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">← Back to trips</Link>
      </div>
    );
  }

  const cities: string[] = JSON.parse(trip.cities);
  const tripSchedule = trip.startDate || trip.durationDays
    ? [
      trip.startDate ? `Start ${trip.startDate}` : null,
      trip.durationDays ? `${trip.durationDays} days` : null,
    ].filter(Boolean).join(' · ')
    : 'Flexible schedule';
  const canEdit = trip.currentRole === 'owner';
  const filteredProposals = filterStatus === 'all' ? proposals : proposals.filter(p => p.status === filterStatus);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="text-sm text-blue-600 hover:underline mb-3 inline-block">← All Trips</Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{trip.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {cities.map(city => (
                <span key={city} className="bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
                  📍 {city}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">{tripSchedule}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/trips/${tripId}/preferences`}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap"
            >
              ⚙️ Preferences
            </Link>
            {trip.currentRole === 'owner' && (
              <button
                onClick={handleDeleteTrip}
                className="bg-white border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium whitespace-nowrap"
              >
                🗑️ Delete Trip
              </button>
            )}
          </div>
        </div>
      </div>
      {trip.currentRole === 'owner' && (
        <form onSubmit={handleShareTrip} className="mb-6 flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="Share with user email"
            required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 text-gray-900"
          />
          <button
            type="submit"
            disabled={sharing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {sharing ? 'Sharing...' : 'Share'}
          </button>
          {shareMessage && <span className="text-sm text-gray-500">{shareMessage}</span>}
        </form>
      )}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {(['proposals', 'itinerary', 'map'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'proposals' ? '💡 Proposals' : tab === 'itinerary' ? '📋 Itinerary' : '🗺️ Map'}
          </button>
        ))}
      </div>

      {activeTab === 'proposals' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating || !canEdit}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? '⏳ Generating...' : '✨ Generate Proposals'}
            </button>
            <div className="flex gap-1 ml-auto">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'createdAt' | 'title' | 'city' | 'status')}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="createdAt">Created time</option>
                <option value="title">Title</option>
                <option value="city">City</option>
                <option value="status">Status</option>
              </select>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              {['all', 'pending', 'approved', 'rejected'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {canEdit && (
            <form onSubmit={handleCreateManualProposal} className="mb-6 border border-gray-200 rounded-xl p-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-3">✍️ Add proposal manually</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  required
                  placeholder="Title"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
                <input
                  value={manualCity}
                  onChange={e => setManualCity(e.target.value)}
                  required
                  placeholder="City"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
                <textarea
                  value={manualDescription}
                  onChange={e => setManualDescription(e.target.value)}
                  required
                  placeholder="Description"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm md:col-span-2 text-gray-900"
                  rows={2}
                />
                <select
                  value={manualType}
                  onChange={e => setManualType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  <option value="place">place</option>
                  <option value="food">food</option>
                </select>
                <select
                  value={manualSuggestedTime}
                  onChange={e => setManualSuggestedTime(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  <option value="morning">morning</option>
                  <option value="lunch">lunch</option>
                  <option value="afternoon">afternoon</option>
                  <option value="dinner">dinner</option>
                  <option value="night">night</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={manualDurationMinutes}
                  onChange={e => setManualDurationMinutes(e.target.value)}
                  placeholder="Duration (minutes, optional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
                <input
                  type="number"
                  step="any"
                  value={manualLat}
                  onChange={e => setManualLat(e.target.value)}
                  placeholder="Latitude (optional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
                <input
                  type="number"
                  step="any"
                  value={manualLng}
                  onChange={e => setManualLng(e.target.value)}
                  placeholder="Longitude (optional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <button
                type="submit"
                disabled={creatingManual}
                className="mt-3 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
              >
                {creatingManual ? 'Saving...' : 'Add Manual Proposal'}
              </button>
              <button
                type="button"
                onClick={handleFillWithAI}
                disabled={fillingDetails || !manualTitle}
                className="mt-3 ml-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {fillingDetails ? '⏳ Filling...' : '✨ Fill with AI'}
              </button>
            </form>
          )}

          {filteredProposals.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">💡</div>
              <p className="text-gray-500 text-lg">No proposals yet</p>
              <p className="text-gray-400 text-sm mt-1">Generate AI proposals for your trip</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProposals.map(proposal => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={canEdit ? handleDeleteProposal : undefined}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'itinerary' && (
        <div>
          <div className="mb-4">
            <button
              onClick={handleOrganizeItinerary}
              disabled={organizing || itinerary.length === 0 || !canEdit}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {organizing ? '⏳ Organizing...' : '🤖 Organize with AI'}
            </button>
          </div>
          <ItineraryView items={itinerary} onReorder={canEdit ? handleReorderItinerary : undefined} />
        </div>
      )}

      {activeTab === 'map' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {proposals.filter(p => p.status === 'approved').length > 0
              ? 'Showing approved proposals on the map'
              : 'Showing all proposals (approve some to highlight them)'}
          </p>
          {proposals.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-5xl mb-3">🗺️</div>
              <p className="text-gray-500">Generate proposals to see them on the map</p>
            </div>
          ) : (
            <MapView proposals={proposals} />
          )}
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open={true}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

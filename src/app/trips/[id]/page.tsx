'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ActivityCard from '@/components/ActivityCard';
import ItineraryView from '@/components/ItineraryView';
import ConfirmDialog from '@/components/ConfirmDialog';
import { compareItineraryTimeBlock } from '@/lib/time-block';
import { buildMapActivities, type ItineraryRouteItem } from '@/lib/map-activities';
import { normalizeActivities, normalizeItineraryItems } from './adapters';
import type { Activity, ChatPlanResponse, ItineraryItem, Tab, Trip } from './types';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const GoogleMapView = dynamic(() => import('@/components/GoogleMapView'), { ssr: false });

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('activities');
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
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [isManualAdvancedOpen, setIsManualAdvancedOpen] = useState(false);
  const [creatingManual, setCreatingManual] = useState(false);
  const [fillingDetails, setFillingDetails] = useState(false);
  const [mapProvider, setMapProvider] = useState<'google' | 'leaflet'>('google');
  const [mapFocusTrigger, setMapFocusTrigger] = useState(0);
  const [showItineraryRoute, setShowItineraryRoute] = useState(false);
  const [itineraryDayFilter, setItineraryDayFilter] = useState<'all' | number>('all');
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleStartDateInput, setScheduleStartDateInput] = useState('');
  const [scheduleDurationDaysInput, setScheduleDurationDaysInput] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [deletingDay, setDeletingDay] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [planningChat, setPlanningChat] = useState(false);
  const [executingChat, setExecutingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatPreview, setChatPreview] = useState<ChatPlanResponse | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [tripRes, activitiesRes, itineraryRes] = await Promise.all([
        fetch(`/api/trips/${tripId}`),
        fetch(`/api/trips/${tripId}/activities?sortBy=${sortBy}&order=${sortOrder}`),
        fetch(`/api/trips/${tripId}/itinerary`),
      ]);
      const [tripData, activitiesData, itineraryData] = await Promise.all([
        tripRes.json(),
        activitiesRes.json(),
        itineraryRes.json(),
      ]);
      setTrip(tripData);
      setActivities(normalizeActivities(activitiesData));
      setItinerary(normalizeItineraryItems(itineraryData));
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

  useEffect(() => {
    if (!trip || editingSchedule) return;
    setScheduleStartDateInput(trip.startDate || '');
    setScheduleDurationDaysInput(trip.durationDays != null ? String(trip.durationDays) : '');
  }, [trip, editingSchedule]);

  const mapActivities = useMemo(() => buildMapActivities(activities, itinerary), [activities, itinerary]);

  const itineraryRoute = useMemo<ItineraryRouteItem[]>(() => {
    return [...itinerary]
      .sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        const tbCompare = compareItineraryTimeBlock(a.timeBlock, b.timeBlock);
        if (tbCompare !== 0) return tbCompare;
        return a.order - b.order;
      })
      .map((item) => ({
        activityId: item.activity.id,
        day: item.day,
        lat: item.activity.lat,
        lng: item.activity.lng,
      }));
  }, [itinerary]);

  const itineraryDays = useMemo(
    () => [...new Set(itinerary.map((item) => item.day))].sort((a, b) => a - b),
    [itinerary]
  );

  async function handleGenerate() {
    if (!selectedCity) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: selectedCity }),
      });
      if (res.ok) {
        const newActivities = await res.json();
        setActivities(prev => [...normalizeActivities(newActivities), ...prev]);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateManualActivity(e: React.FormEvent) {
    e.preventDefault();
    setCreatingManual(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/activities`, {
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
        setActivities(prev => [created, ...prev]);
        setManualTitle('');
        setManualDescription('');
        setManualDurationMinutes('');
        setManualLat('');
        setManualLng('');
        setIsManualAdvancedOpen(false);
        setIsManualFormOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to create activity. Please check the form and try again.');
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
      const res = await fetch(`/api/trips/${tripId}/activities/fill`, {
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

  async function handleApprove(activityId: string) {
    const res = await fetch(`/api/activities/${activityId}/approve`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setActivities(prev => prev.map(p => p.id === activityId ? { ...p, status: 'approved' } : p));
      if (data.itineraryItem) {
        setItinerary(prev => [...prev, ...normalizeItineraryItems([data.itineraryItem])]);
      }
    }
  }

  async function handleReject(activityId: string) {
    const res = await fetch(`/api/activities/${activityId}/reject`, { method: 'POST' });
    if (res.ok) {
      setActivities(prev => prev.map(p => p.id === activityId ? { ...p, status: 'rejected' } : p));
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
      .sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        const timeBlockCmp = compareItineraryTimeBlock(a.timeBlock, b.timeBlock);
        if (timeBlockCmp !== 0) return timeBlockCmp;
        return a.order - b.order;
      });
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

  async function handleAddItineraryDay() {
    setAddingDay(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/days`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.trip) {
        setTrip((prev) => (prev ? { ...prev, ...data.trip } : prev));
      } else {
        alert(data.error || 'Failed to add itinerary day.');
      }
    } finally {
      setAddingDay(false);
    }
  }

  async function handleDeleteEmptyDay(day: number) {
    setDeletingDay(day);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/days`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.trip) setTrip((prev) => (prev ? { ...prev, ...data.trip } : prev));
        if (Array.isArray(data.itinerary)) setItinerary(data.itinerary);
      } else {
        alert(data.error || 'Failed to delete itinerary day.');
      }
    } finally {
      setDeletingDay(null);
    }
  }

  async function handleDeleteTrip() {
    setConfirmDialog({
      message: 'Delete this trip? All activities and itinerary items will be permanently removed.',
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

  async function handleDeleteActivity(activityId: string) {
    setConfirmDialog({
      message: 'Delete this activity? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        const res = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' });
        if (res.ok) {
          setActivities(prev => prev.filter(p => p.id !== activityId));
          setItinerary(prev => prev.filter(item => item.activity.id !== activityId));
        } else {
          alert('Failed to delete activity. Please try again.');
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

  async function handleAddGooglePlace(place: {
    placeId: string;
    title: string;
    lat: number;
    lng: number;
    city: string;
    formattedAddress: string;
    types: string[];
  }) {
    const res = await fetch(`/api/trips/${tripId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'google_place',
        placeId: place.placeId,
        title: place.title,
        city: place.city || selectedCity,
        lat: place.lat,
        lng: place.lng,
        formattedAddress: place.formattedAddress,
        types: place.types,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      setActivities((prev) => [created, ...prev]);
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Failed to add place from Google Maps.');
  }

  async function handlePlanChat() {
    if (!chatMessage.trim()) return;
    setPlanningChat(true);
    setChatError('');
    setChatPreview(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/chat/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatMessage.trim(),
          context: {
            selectedCity,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setChatPreview({
          summary: data.summary || '',
          actionPlan: Array.isArray(data.actionPlan) ? data.actionPlan : [],
        });
      } else {
        setChatError(data.error || 'Failed to preview chat actions.');
      }
    } finally {
      setPlanningChat(false);
    }
  }

  async function handleConfirmChat() {
    if (!chatPreview) return;
    setExecutingChat(true);
    setChatError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/chat/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionPlan: chatPreview.actionPlan }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.trip) setTrip((prev) => (prev ? { ...prev, ...data.trip } : prev));
        if (Array.isArray(data.activities)) setActivities(normalizeActivities(data.activities));
        if (Array.isArray(data.itinerary)) setItinerary(normalizeItineraryItems(data.itinerary));
        setChatPreview(null);
      } else {
        setChatError(data.error || 'Failed to apply chat actions.');
      }
    } finally {
      setExecutingChat(false);
    }
  }

  function handleStartEditSchedule() {
    if (!trip) return;
    setScheduleStartDateInput(trip.startDate || '');
    setScheduleDurationDaysInput(trip.durationDays != null ? String(trip.durationDays) : '');
    setEditingSchedule(true);
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: scheduleStartDateInput || '',
          durationDays: scheduleDurationDaysInput || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTrip((prev) => (prev ? { ...prev, ...data } : prev));
        setEditingSchedule(false);
      } else {
        alert(data.error || 'Failed to update trip schedule.');
      }
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleClearSchedule() {
    setSavingSchedule(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '',
          durationDays: '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTrip((prev) => (prev ? { ...prev, ...data } : prev));
        setScheduleStartDateInput('');
        setScheduleDurationDaysInput('');
        setEditingSchedule(false);
      } else {
        alert(data.error || 'Failed to clear trip schedule.');
      }
    } finally {
      setSavingSchedule(false);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'map') {
      setMapFocusTrigger((prev) => prev + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 spinner-gradient"></div>
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
  const filteredActivities = filterStatus === 'all' ? activities : activities.filter((activity) => activity.status === filterStatus);
  const arrangedMapCount = mapActivities.filter((activity) => activity.isArranged).length;
  const maxItineraryDay = itinerary.reduce((max, item) => Math.max(max, item.day), 0);
  const hasOverRangeDays = typeof trip.durationDays === 'number' && trip.durationDays > 0 && maxItineraryDay > trip.durationDays;

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
            {editingSchedule ? (
              <form onSubmit={handleSaveSchedule} className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={scheduleStartDateInput}
                    onChange={(e) => setScheduleStartDateInput(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duration Days</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={scheduleDurationDaysInput}
                    onChange={(e) => setScheduleDurationDaysInput(e.target.value)}
                    placeholder="e.g. 5"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 w-36"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingSchedule ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={savingSchedule}
                    onClick={() => setEditingSchedule(false)}
                    className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingSchedule}
                    onClick={handleClearSchedule}
                    className="border border-red-300 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm text-gray-500">{tripSchedule}</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleStartEditSchedule}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit schedule
                  </button>
                )}
              </div>
            )}
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
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
          >
            {sharing ? 'Sharing...' : 'Share'}
          </button>
          {shareMessage && <span className="text-sm text-gray-500">{shareMessage}</span>}
        </form>
      )}

      <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl mb-6 w-fit backdrop-blur-sm shadow-sm">
        {(['activities', 'itinerary', 'map', ...(canEdit ? (['ai'] as Tab[]) : [])] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'activities' ? '💡 Activities' : tab === 'itinerary' ? '📋 Itinerary' : tab === 'map' ? '🗺️ Map' : '🤖 AI (Experimental)'}
          </button>
        ))}
      </div>

      {activeTab === 'activities' && (
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
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {generating ? '⏳ Generating...' : '✨ Generate Activities'}
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
            <div className="mb-6 border border-gray-200 rounded-xl bg-gray-50">
              <button
                type="button"
                onClick={() => setIsManualFormOpen(prev => !prev)}
                aria-expanded={isManualFormOpen}
                aria-controls="manual-activity-form"
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 rounded-xl transition-colors"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-700">✍️ Add activity manually</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Quick add a place idea</span>
                </span>
                <span className="text-sm text-gray-500">{isManualFormOpen ? '▾' : '▸'}</span>
              </button>
              {isManualFormOpen && (
                <form
                  id="manual-activity-form"
                  onSubmit={handleCreateManualActivity}
                  className="px-4 pb-4 pt-1 border-t border-gray-200"
                >
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
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsManualAdvancedOpen(prev => !prev)}
                    aria-expanded={isManualAdvancedOpen}
                    aria-controls="manual-activity-advanced"
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {isManualAdvancedOpen ? 'Hide advanced details' : 'Show advanced details'}
                  </button>
                  {isManualAdvancedOpen && (
                    <div id="manual-activity-advanced" className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={creatingManual}
                      className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50"
                    >
                      {creatingManual ? 'Saving...' : 'Add Manual Activity'}
                    </button>
                    <button
                      type="button"
                      onClick={handleFillWithAI}
                      disabled={fillingDetails || !manualTitle}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {fillingDetails ? '⏳ Filling...' : '✨ Fill with AI'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {filteredActivities.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">💡</div>
              <p className="text-gray-500 text-lg">No activities yet</p>
              <p className="text-gray-400 text-sm mt-1">Generate AI activities for your trip</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={canEdit ? handleDeleteActivity : undefined}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'itinerary' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOrganizeItinerary}
              disabled={organizing || itinerary.length === 0 || !canEdit}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-purple-700 hover:to-fuchsia-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {organizing ? '⏳ Organizing...' : '🤖 Organize with AI'}
            </button>
            {canEdit && !trip.durationDays && (
              <button
                type="button"
                onClick={handleAddItineraryDay}
                disabled={addingDay}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {addingDay ? 'Adding...' : '+ Add Day'}
              </button>
            )}
            {hasOverRangeDays && (
              <p className="text-xs text-amber-700 mt-2">
                Some itinerary days exceed your planned duration ({trip.durationDays} days). You can keep it as-is or drag items back into range.
              </p>
            )}
          </div>
          <ItineraryView
            items={itinerary}
            schedule={{
              startDate: trip.startDate,
              durationDays: trip.durationDays,
              itineraryVisibleDays: trip.itineraryVisibleDays,
            }}
            onReorder={canEdit ? handleReorderItinerary : undefined}
            onDeleteEmptyDay={canEdit && !trip.durationDays ? handleDeleteEmptyDay : undefined}
            deletingDay={deletingDay}
          />
        </div>
      )}

      {activeTab === 'map' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMapProvider('google')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mapProvider === 'google' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Google Maps (Beta)
            </button>
            <button
              type="button"
              onClick={() => setMapProvider('leaflet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mapProvider === 'leaflet' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Leaflet (Legacy)
            </button>
          </div>
          {itinerary.length > 0 && (
            <div className="flex items-center flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => setShowItineraryRoute((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showItineraryRoute ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {showItineraryRoute ? '🗺 Route: On' : '🗺 Route: Off'}
              </button>
              {showItineraryRoute && itineraryDays.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setItineraryDayFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      itineraryDayFilter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    All Days
                  </button>
                  {itineraryDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setItineraryDayFilter(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        itineraryDayFilter === day ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Day {day}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4">
            Showing {arrangedMapCount} arranged and {mapActivities.length - arrangedMapCount} unarranged activities (rejected hidden)
          </p>
          {mapProvider === 'google' ? (
            <GoogleMapView
              activities={mapActivities}
              canEdit={canEdit}
              onAddPlace={handleAddGooglePlace}
              focusTrigger={mapFocusTrigger}
              itineraryRoute={itineraryRoute}
              showItineraryRoute={showItineraryRoute}
              itineraryDayFilter={itineraryDayFilter}
            />
          ) : (
            mapActivities.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-5xl mb-3">🗺️</div>
                <p className="text-gray-500">Generate activities to see them on the map</p>
              </div>
            ) : (
              <MapView
                activities={mapActivities}
                itineraryRoute={itineraryRoute}
                showItineraryRoute={showItineraryRoute}
                itineraryDayFilter={itineraryDayFilter}
              />
            )
          )}
        </div>
      )}

      {activeTab === 'ai' && canEdit && (
        <div className="border border-blue-200 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-blue-900">🤖 Chat Planner (Experimental)</h2>
          <p className="text-xs text-blue-700 mt-1">Describe changes in natural language. Preview first, then confirm to apply.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask Chat Planner (e.g. add a sushi activity in Tokyo and organize itinerary)"
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm flex-1 text-gray-900"
            />
            <button
              type="button"
              onClick={handlePlanChat}
              disabled={planningChat || !chatMessage.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {planningChat ? 'Previewing...' : 'Preview Changes'}
            </button>
          </div>
          {chatError && <p className="text-sm text-red-600 mt-2">{chatError}</p>}
          {chatPreview && (
            <div className="mt-3 bg-white border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">{chatPreview.summary || 'Ready to apply planned changes.'}</p>
              <ul className="mt-2 text-xs text-gray-600 list-disc pl-4 space-y-1">
                {chatPreview.actionPlan.map((action, index) => (
                  <li key={`${action.type}-${index}`}>
                    <span className="font-medium">{action.type}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmChat}
                  disabled={executingChat}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {executingChat ? 'Applying...' : 'Confirm Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => setChatPreview(null)}
                  disabled={executingChat}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
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

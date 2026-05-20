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
import { computeTripReadiness } from '@/lib/trip-readiness';
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
  const [approvingAll, setApprovingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [revokingLink, setRevokingLink] = useState(false);
  const [copyLinkMsg, setCopyLinkMsg] = useState('');
  const [weatherByDay, setWeatherByDay] = useState<Record<number, { date: string; weathercode: number; temp_max: number; temp_min: number; emoji: string; label: string }>>({});

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
      if (tripData?.shareToken) setShareToken(tripData.shareToken as string);
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
    if (tab === 'itinerary') {
      fetchWeather();
    }
  }

  async function fetchWeather() {
    if (!trip?.startDate || !trip.cities) return;
    const cities: string[] = JSON.parse(trip.cities);
    if (!cities.length) return;
    const primaryCity = cities[0];
    const days = Math.min(Math.max(trip.durationDays ?? 7, 7), 16);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(primaryCity)}&startDate=${trip.startDate}&days=${days}`);
      if (!res.ok) return;
      const data = await res.json() as { forecasts: { date: string; weathercode: number; temp_max: number; temp_min: number; emoji: string; label: string }[] };
      if (!Array.isArray(data.forecasts) || !trip.startDate) return;
      const startDateObj = new Date(trip.startDate + 'T00:00:00Z');
      const byDay: Record<number, { date: string; weathercode: number; temp_max: number; temp_min: number; emoji: string; label: string }> = {};
      data.forecasts.forEach(f => {
        const fDate = new Date(f.date + 'T00:00:00Z');
        const diffDays = Math.round((fDate.getTime() - startDateObj.getTime()) / 86400000);
        const day = diffDays + 1;
        if (day >= 1) byDay[day] = f;
      });
      setWeatherByDay(byDay);
    } catch {
      // weather is non-critical, ignore errors
    }
  }

  async function handleGenerateShareLink() {
    setGeneratingLink(true);
    setCopyLinkMsg('');
    try {
      const res = await fetch(`/api/trips/${tripId}/public-link`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { shareToken: string };
        setShareToken(data.shareToken);
      }
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleRevokeShareLink() {
    setRevokingLink(true);
    setCopyLinkMsg('');
    try {
      const res = await fetch(`/api/trips/${tripId}/public-link`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setShareToken(null);
      }
    } finally {
      setRevokingLink(false);
    }
  }

  function handleCopyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    try {
      navigator.clipboard.writeText(url).then(() => {
        setCopyLinkMsg('Copied!');
        setTimeout(() => setCopyLinkMsg(''), 2000);
      }).catch(() => {
        setCopyLinkMsg(url);
      });
    } catch {
      setCopyLinkMsg(url);
    }
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/activities/approve-all`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activities)) {
          setActivities((prev) =>
            prev.map((a) => {
              const updated = (data.activities as Activity[]).find((u) => u.id === a.id);
              return updated ?? a;
            })
          );
        }
        if (Array.isArray(data.itineraryItems)) {
          setItinerary((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const newItems = normalizeItineraryItems(data.itineraryItems).filter(
              (item) => !existingIds.has(item.id)
            );
            return [...prev, ...newItems];
          });
        }
      }
    } finally {
      setApprovingAll(false);
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
        <Link href="/" className="text-amber-800 hover:underline mt-4 inline-block">← Back to trips</Link>
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
  const pendingCount = activities.filter((a) => a.status === 'pending').length;
  const approvedCount = activities.filter((a) => a.status === 'approved').length;
  const filteredActivities = activities.filter((activity) => {
    const matchesStatus = filterStatus === 'all' || activity.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || activity.title.toLowerCase().includes(q) || activity.description.toLowerCase().includes(q) || activity.city.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });
  const arrangedMapCount = mapActivities.filter((activity) => activity.isArranged).length;
  const conciergeReadiness = computeTripReadiness({
    destinationCount: cities.length,
    hasSchedule: Boolean(trip.startDate || trip.durationDays),
    activitiesCount: activities.length,
    approvedCount,
    itineraryItemsCount: itinerary.length,
    mappedArrangedCount: arrangedMapCount,
    hasShareLink: Boolean(shareToken),
  });
  const maxItineraryDay = itinerary.reduce((max, item) => Math.max(max, item.day), 0);
  const hasOverRangeDays = typeof trip.durationDays === 'number' && trip.durationDays > 0 && maxItineraryDay > trip.durationDays;

  return (
    <div className="relative overflow-hidden bg-[#f7f1e8]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top_left,_rgba(180,130,60,0.20),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(31,23,16,0.14),_transparent_34%),linear-gradient(180deg,_#fbf7ef_0%,_#ffffff_82%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Link href="/" className="inline-flex rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-sm font-bold text-stone-600 shadow-sm transition-colors hover:border-amber-300 hover:text-amber-800">← All Trips</Link>
        </div>

        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="rounded-[2rem] border border-amber-100 bg-white/88 p-6 shadow-2xl shadow-amber-900/10 backdrop-blur sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-amber-800">Private dossier workspace</p>
            <h1 className="mt-3 max-w-4xl font-serif text-5xl font-black tracking-tight text-stone-950 sm:text-6xl">
              {trip.name}
            </h1>
            <p className="mt-3 text-sm font-semibold text-stone-500">
              {cities.length} {cities.length === 1 ? 'destination' : 'destinations'} · {cities.join(' · ')}
            </p>

            {editingSchedule ? (
              <form onSubmit={handleSaveSchedule} className="mt-5 flex flex-col gap-3 rounded-3xl border border-amber-100 bg-[#fffaf2] p-4 sm:flex-row sm:items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={scheduleStartDateInput}
                    onChange={(e) => setScheduleStartDateInput(e.target.value)}
                    className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 mb-1">Duration Days</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={scheduleDurationDaysInput}
                    onChange={(e) => setScheduleDurationDaysInput(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-36 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="rounded-full bg-[#1f1710] px-4 py-2 text-sm font-black text-amber-50 shadow-sm hover:bg-[#352719] disabled:opacity-50"
                  >
                    {savingSchedule ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={savingSchedule}
                    onClick={() => setEditingSchedule(false)}
                    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingSchedule}
                    onClick={handleClearSchedule}
                    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-800 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-amber-200 bg-[#fffaf2] px-4 py-2 text-sm font-black text-stone-700">{tripSchedule}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleStartEditSchedule}
                    className="text-sm font-bold text-amber-800 hover:underline"
                  >
                    Edit schedule
                  </button>
                )}
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleTabChange('itinerary')}
                className="rounded-full bg-[#1f1710] px-5 py-3 text-sm font-black text-amber-50 shadow-xl shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-[#352719]"
              >
                Open itinerary
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('activities')}
                className="rounded-full border border-amber-200 bg-white px-5 py-3 text-sm font-black text-stone-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
              >
                Review ideas
              </button>
            </div>

            <div className="mt-8 rounded-3xl border border-amber-100 bg-[#fffaf2] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Concierge readiness</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">{conciergeReadiness.nextStep}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-stone-950">{conciergeReadiness.score}%</span>
                  <span className="rounded-full bg-[#1f1710] px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-50">
                    {conciergeReadiness.stage}
                  </span>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-amber-700" style={{ width: `${conciergeReadiness.score}%` }} />
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24">
            <details className="group rounded-[2rem] border border-amber-100 bg-white/88 p-4 shadow-xl shadow-amber-900/10 backdrop-blur">
              <summary className="cursor-pointer list-none rounded-2xl px-3 py-2 text-sm font-black uppercase tracking-[0.18em] text-stone-700 transition-colors hover:bg-amber-50">
                Trip settings
                <span className="float-right text-stone-400 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-4 space-y-5 border-t border-amber-100 pt-4">
                <Link
                  href={`/trips/${tripId}/preferences`}
                  className="block rounded-2xl border border-amber-100 bg-[#fffaf2] px-4 py-3 text-sm font-bold text-stone-700 transition hover:border-amber-200 hover:text-amber-800"
                >
                  ⚙️ Preferences
                </Link>

                {trip.currentRole === 'owner' && (
                  <div className="space-y-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Share dossier</p>
                    <form onSubmit={handleShareTrip} className="space-y-2">
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="Share with user email"
                        required
                        className="w-full rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                      <button
                        type="submit"
                        disabled={sharing}
                        className="w-full rounded-full bg-[#1f1710] px-4 py-2 text-sm font-black text-amber-50 hover:bg-[#352719] disabled:opacity-50"
                      >
                        {sharing ? 'Sharing...' : 'Share'}
                      </button>
                      {shareMessage && <span className="text-sm text-stone-500">{shareMessage}</span>}
                    </form>
                    {shareToken ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleCopyShareLink}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 transition-colors hover:border-amber-300"
                        >
                          🔗 Copy public link
                        </button>
                        <button
                          type="button"
                          onClick={handleRevokeShareLink}
                          disabled={revokingLink}
                          className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-500 transition-colors hover:text-stone-800 disabled:opacity-50"
                        >
                          {revokingLink ? 'Revoking...' : 'Revoke link'}
                        </button>
                        {copyLinkMsg && <span className="text-xs font-bold text-emerald-600">{copyLinkMsg}</span>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateShareLink}
                        disabled={generatingLink}
                        className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-600 transition-colors hover:border-amber-200 hover:text-amber-800 disabled:opacity-50"
                      >
                        {generatingLink ? 'Generating...' : '🔗 Generate public link'}
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Readiness checklist</p>
                  {conciergeReadiness.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border px-3 py-2 text-sm ${item.complete ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-100 bg-[#fffaf2] text-stone-500'}`}
                      title={item.detail}
                    >
                      <span className="font-black">{item.complete ? '✓' : '○'} {item.label}</span>
                    </div>
                  ))}
                </div>

                {trip.currentRole === 'owner' && (
                  <button
                    onClick={handleDeleteTrip}
                    className="w-full rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-500 transition-colors hover:text-stone-900"
                  >
                    Delete Trip
                  </button>
                )}
              </div>
            </details>
          </aside>
        </section>

        <section data-testid="planning-pipeline" className="mb-6 rounded-[1.75rem] border border-amber-100 bg-white/88 p-4 shadow-lg shadow-amber-900/5 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">Planning pipeline</p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-black text-stone-700">
              <span>{activities.length} ideas</span>
              <span className="text-amber-700">→</span>
              <span>{approvedCount} approved</span>
              <span className="text-amber-700">→</span>
              <span>{itinerary.length} scheduled</span>
              <span className="text-amber-700">→</span>
              <span>{arrangedMapCount} mapped</span>
            </div>
          </div>
        </section>

        <div className="mb-0 rounded-t-[1.75rem] border border-b-0 border-amber-100 bg-white/88 p-2 shadow-sm backdrop-blur">
          <div className="flex flex-wrap gap-1">
            {(['activities', 'itinerary', 'map', ...(canEdit ? (['ai'] as Tab[]) : [])] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-5 py-2 rounded-2xl text-sm font-bold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-[#1f1710] text-amber-50 shadow-sm'
                    : 'text-stone-600 hover:bg-amber-50 hover:text-stone-900'
                }`}
              >
                {tab === 'activities' ? (
                  <span className="flex items-center gap-1.5">
                    Activities
                    {pendingCount > 0 && (
                      <span data-testid="activities-tab-badge" className="bg-amber-200 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                        {pendingCount}
                      </span>
                    )}
                  </span>
                ) : tab === 'itinerary' ? 'Itinerary' : tab === 'map' ? 'Map' : 'AI (Experimental)'}
              </button>
            ))}
          </div>
        </div>

      {activeTab === 'activities' && (
        <div>
          <div className="mb-6 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900"
            >
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              disabled={generating || !canEdit}
              className="bg-gradient-to-r from-amber-800 to-stone-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-amber-900 hover:to-stone-950 disabled:opacity-50 transition-all shadow-sm"
            >
              {generating ? '⏳ Generating...' : '✨ Generate Activities'}
            </button>
            {canEdit && pendingCount > 0 && (
              <button
                onClick={handleApproveAll}
                disabled={approvingAll}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {approvingAll ? '⏳ Approving...' : `✓ Approve All (${pendingCount})`}
              </button>
            )}
            <div className="flex gap-1 ml-auto flex-wrap">
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 Search activities..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 w-44"
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'createdAt' | 'title' | 'city' | 'status')}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900"
              >
                <option value="createdAt">Created time</option>
                <option value="title">Title</option>
                <option value="city">City</option>
                <option value="status">Status</option>
              </select>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900"
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
                      ? 'bg-amber-100 text-amber-800'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
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
                    className="mt-3 text-xs text-amber-800 hover:text-amber-800 font-medium"
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
                      className="bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
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
                className="bg-gradient-to-r from-amber-800 to-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-amber-900 hover:to-stone-950 disabled:opacity-50 transition-all shadow-sm"
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
            weatherByDay={weatherByDay}
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
                mapProvider === 'google' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Google Maps (Beta)
            </button>
            <button
              type="button"
              onClick={() => setMapProvider('leaflet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mapProvider === 'leaflet' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
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
        <div className="border border-amber-200 rounded-xl bg-gradient-to-br from-amber-50 to-stone-50 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-900">🤖 Chat Planner (Experimental)</h2>
          <p className="text-xs text-amber-800 mt-1">Describe changes in natural language. Preview first, then confirm to apply.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask Chat Planner (e.g. add a sushi activity in Tokyo and organize itinerary)"
              className="border border-amber-200 rounded-lg px-3 py-2 text-sm flex-1 text-gray-900"
            />
            <button
              type="button"
              onClick={handlePlanChat}
              disabled={planningChat || !chatMessage.trim()}
              className="bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-900 disabled:opacity-50"
            >
              {planningChat ? 'Previewing...' : 'Preview Changes'}
            </button>
          </div>
          {chatError && <p className="text-sm text-red-600 mt-2">{chatError}</p>}
          {chatPreview && (
            <div className="mt-3 bg-white border border-amber-200 rounded-lg p-3">
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
    </div>
  );
}

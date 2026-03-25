'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildDailyAccommodationPlan } from '@/lib/accommodation';

type Accommodation = {
  id: string;
  tripId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  checkInDate: string;
  checkOutDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  tripId: string;
  canEdit: boolean;
  startDate?: string | null;
  durationDays?: number | null;
};

export default function AccommodationPanel({ tripId, canEdit, startDate, durationDays }: Props) {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const fetchAccommodations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/accommodations`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to load accommodations.');
        setAccommodations([]);
        return;
      }
      setAccommodations(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchAccommodations();
  }, [fetchAccommodations]);

  const dailyPlan = useMemo(
    () => buildDailyAccommodationPlan({ startDate, durationDays, accommodations }),
    [startDate, durationDays, accommodations]
  );

  function resetForm() {
    setEditingId(null);
    setName('');
    setAddress('');
    setCheckInDate('');
    setCheckOutDate('');
    setNotes('');
    setLat('');
    setLng('');
  }

  function handleStartEdit(accommodation: Accommodation) {
    setEditingId(accommodation.id);
    setName(accommodation.name);
    setAddress(accommodation.address);
    setCheckInDate(accommodation.checkInDate);
    setCheckOutDate(accommodation.checkOutDate);
    setNotes(accommodation.notes ?? '');
    setLat(accommodation.lat == null ? '' : String(accommodation.lat));
    setLng(accommodation.lng == null ? '' : String(accommodation.lng));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const normalizedName = name.trim();
    const normalizedAddress = address.trim();
    const normalizedCheckInDate = checkInDate.trim();
    const normalizedCheckOutDate = checkOutDate.trim();

    if (!normalizedName || !normalizedAddress || !normalizedCheckInDate || !normalizedCheckOutDate) {
      setError('name, address, checkInDate, and checkOutDate are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: normalizedName,
        address: normalizedAddress,
        checkInDate: normalizedCheckInDate,
        checkOutDate: normalizedCheckOutDate,
        notes: notes.trim() ? notes.trim() : null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
      };
      const url = editingId ? `/api/accommodations/${editingId}` : `/api/trips/${tripId}/accommodations`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to save accommodation.');
        return;
      }

      resetForm();
      await fetchAccommodations();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`/api/accommodations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === 'string' ? data.error : 'Failed to delete accommodation.');
        return;
      }
      if (editingId === id) resetForm();
      await fetchAccommodations();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mb-6 border border-gray-200 rounded-xl bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">🏨 Accommodation</h3>
        <p className="text-xs text-gray-500">Manage stay segments and map them to each trip day.</p>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {canEdit && (
        <form noValidate onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-gray-200 rounded-lg p-3 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Accommodation name"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <input
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <input
            type="date"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Lat (optional)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Lng (optional)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update stay' : 'Add stay'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      <div className="space-y-2 mb-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading accommodations...</p>
        ) : accommodations.length === 0 ? (
          <p className="text-sm text-gray-500">No accommodations yet.</p>
        ) : (
          accommodations.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-600">{item.address}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.checkInDate} to {item.checkOutDate}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Daily Stay</h4>
        {!startDate || !durationDays ? (
          <p className="text-xs text-gray-500">Set trip start date and duration to display daily stay mapping.</p>
        ) : dailyPlan.length === 0 ? (
          <p className="text-xs text-gray-500">No daily stay data.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {dailyPlan.map((row) => (
              <div key={row.day} className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">Day {row.day} · {row.date}</p>
                <p className="text-sm text-gray-800 mt-1">{row.accommodation?.name ?? 'Unassigned'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

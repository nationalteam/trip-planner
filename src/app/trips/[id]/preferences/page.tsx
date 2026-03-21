'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
}

interface Preference {
  id: string;
  userId: string;
  likes: string;
  dislikes: string;
  budget: string | null;
}

export default function PreferencesPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [preferences, setPreferences] = useState<Preference | null>(null);
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [budget, setBudget] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) fetchPreferences(selectedUserId);
  }, [selectedUserId]);

  async function fetchUsers() {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
    if (data.length > 0) setSelectedUserId(data[0].id);
  }

  async function fetchPreferences(userId: string) {
    const res = await fetch(`/api/users/${userId}/preferences`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        setPreferences(data);
        setLikes(JSON.parse(data.likes).join(', '));
        setDislikes(JSON.parse(data.dislikes).join(', '));
        setBudget(data.budget || '');
      } else {
        setPreferences(null);
        setLikes('');
        setDislikes('');
        setBudget('');
      }
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName }),
      });
      if (res.ok) {
        const user = await res.json();
        setUsers(prev => [...prev, user]);
        setSelectedUserId(user.id);
        setNewUserName('');
      }
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const likesArr = likes.split(',').map(s => s.trim()).filter(Boolean);
      const dislikesArr = dislikes.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`/api/users/${selectedUserId}/preferences`, {
        method: preferences ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ likes: likesArr, dislikes: dislikesArr, budget }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href={`/trips/${tripId}`} className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Back to Trip
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Travel Preferences</h1>
      <p className="text-gray-500 mb-8">Set preferences to get personalized AI proposals for your trip.</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Select Traveler</h2>
        {users.length > 0 ? (
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          >
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-gray-500 text-sm mb-4">No travelers yet. Create one below.</p>
        )}

        <form onSubmit={handleCreateUser} className="flex gap-2">
          <input
            type="text"
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
            placeholder="Add new traveler..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={creatingUser || !newUserName}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      {selectedUserId && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            {preferences ? 'Edit Preferences' : 'Set Preferences'}
          </h2>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Likes <span className="font-normal text-gray-500">(comma separated)</span>
              </label>
              <input
                type="text"
                value={likes}
                onChange={e => setLikes(e.target.value)}
                placeholder="e.g. Italian food, museums, hiking, jazz music"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dislikes <span className="font-normal text-gray-500">(comma separated)</span>
              </label>
              <input
                type="text"
                value={dislikes}
                onChange={e => setDislikes(e.target.value)}
                placeholder="e.g. crowded tourist traps, fast food, clubs"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
              <select
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not specified</option>
                <option value="budget">💰 Budget</option>
                <option value="mid-range">💰💰 Mid-range</option>
                <option value="luxury">💰💰💰 Luxury</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Preferences'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

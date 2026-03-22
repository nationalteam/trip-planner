'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Preference {
  id: string;
  userId: string;
  likes: string;
  dislikes: string;
  budget: string | null;
  preferredLanguage: string | null;
}

interface Me {
  id: string;
  email: string;
  name: string;
}

export default function PreferencesPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [me, setMe] = useState<Me | null>(null);
  const [preferences, setPreferences] = useState<Preference | null>(null);
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [budget, setBudget] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchMeAndPreferences();
  }, []);

  async function fetchMeAndPreferences() {
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      setMe(meData);
    }

    const prefRes = await fetch('/api/me/preferences');
    if (prefRes.ok) {
      const data = await prefRes.json();
      if (data) {
        setPreferences(data);
        setLikes(JSON.parse(data.likes).join(', '));
        setDislikes(JSON.parse(data.dislikes).join(', '));
        setBudget(data.budget || '');
        setPreferredLanguage(data.preferredLanguage || '');
      }
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const likesArr = likes.split(',').map((s) => s.trim()).filter(Boolean);
      const dislikesArr = dislikes.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/me/preferences', {
        method: preferences ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ likes: likesArr, dislikes: dislikesArr, budget, preferredLanguage }),
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
      <p className="text-gray-500 mb-2">Set preferences to get personalized AI proposals for your trip.</p>
      {me && <p className="text-sm text-gray-400 mb-8">Current traveler: {me.name} ({me.email})</p>}

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
              onChange={(e) => setLikes(e.target.value)}
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
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="e.g. crowded tourist traps, fast food, clubs"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not specified</option>
              <option value="zh-TW">繁體中文</option>
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
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
    </div>
  );
}

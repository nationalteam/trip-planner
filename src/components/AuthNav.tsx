'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Me = {
  id: string;
  email: string;
  name: string;
};

export default function AuthNav() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setMe(data);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth');
    router.refresh();
  }

  if (!me) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-blue-100">{me.name}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-md transition-colors"
      >
        登出
      </button>
    </div>
  );
}

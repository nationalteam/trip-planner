'use client';

import { useEffect, useRef } from 'react';
import { normalizeCoordinateBatch } from '@/lib/coordinates';

interface MapActivity {
  id: string;
  title: string;
  description: string;
  type: string;
  lat: number;
  lng: number;
  city: string;
  status: string;
}

interface MapViewProps {
  activities?: MapActivity[];
  proposals?: MapActivity[];
}

const DEFAULT_CENTER = { lat: 48.8566, lng: 2.3522 };

export default function MapView({ activities, proposals }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mapActivities = activities ?? proposals ?? [];

  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const iconPrototype = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown };
      delete iconPrototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const validActivities = normalizeCoordinateBatch(mapActivities, { reference: DEFAULT_CENTER });
      const approvedActivities = validActivities.filter((activity) => activity.status === 'approved');

      let centerLat = DEFAULT_CENTER.lat;
      let centerLng = DEFAULT_CENTER.lng;

      if (approvedActivities.length > 0) {
        centerLat = approvedActivities.reduce((sum, activity) => sum + activity.lat, 0) / approvedActivities.length;
        centerLng = approvedActivities.reduce((sum, activity) => sum + activity.lng, 0) / approvedActivities.length;
      } else if (validActivities.length > 0) {
        centerLat = validActivities.reduce((sum, activity) => sum + activity.lat, 0) / validActivities.length;
        centerLng = validActivities.reduce((sum, activity) => sum + activity.lng, 0) / validActivities.length;
      }

      const map = L.map(mapRef.current).setView([centerLat, centerLng], 12);

      if (cancelled) {
        map.remove();
        return;
      }

      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const toShow = approvedActivities.length > 0 ? approvedActivities : validActivities;

      toShow.forEach((activity) => {
        const icon = L.divIcon({
          html: `<div style="background:${activity.status === 'approved' ? '#16a34a' : '#2563eb'};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            ${activity.type === 'food' ? '🍽' : activity.type === 'hotel' ? '🏨' : '🏛'}
          </div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        L.marker([activity.lat, activity.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:180px">
              <strong style="font-size:14px">${activity.title}</strong>
              <p style="font-size:12px;margin:4px 0;color:#555">${activity.city}</p>
              <p style="font-size:12px;color:#374151">${activity.description}</p>
              <span style="font-size:11px;background:${activity.status === 'approved' ? '#dcfce7' : '#dbeafe'};color:${activity.status === 'approved' ? '#166534' : '#1e40af'};padding:2px 8px;border-radius:12px;">${activity.status}</span>
            </div>
          `);
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapActivities]);

  return (
    <div ref={mapRef} className="w-full h-[500px] rounded-xl overflow-hidden shadow-sm border border-gray-200" />
  );
}

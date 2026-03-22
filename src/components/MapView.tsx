'use client';

import { useEffect, useRef } from 'react';
import { normalizeCoordinateBatch } from '@/lib/coordinates';

interface Proposal {
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
  proposals: Proposal[];
}

const DEFAULT_CENTER = { lat: 48.8566, lng: 2.3522 };

export default function MapView({ proposals }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

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

      const validProposals = normalizeCoordinateBatch(proposals, { reference: DEFAULT_CENTER });
      const approvedProposals = validProposals.filter(p => p.status === 'approved');

      let centerLat = DEFAULT_CENTER.lat;
      let centerLng = DEFAULT_CENTER.lng;

      if (approvedProposals.length > 0) {
        centerLat = approvedProposals.reduce((sum, p) => sum + p.lat, 0) / approvedProposals.length;
        centerLng = approvedProposals.reduce((sum, p) => sum + p.lng, 0) / approvedProposals.length;
      } else if (validProposals.length > 0) {
        centerLat = validProposals.reduce((sum, p) => sum + p.lat, 0) / validProposals.length;
        centerLng = validProposals.reduce((sum, p) => sum + p.lng, 0) / validProposals.length;
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

      const toShow = approvedProposals.length > 0 ? approvedProposals : validProposals;

      toShow.forEach(proposal => {
        const icon = L.divIcon({
          html: `<div style="background:${proposal.status === 'approved' ? '#16a34a' : '#2563eb'};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
            ${proposal.type === 'food' ? '🍽' : '🏛'}
          </div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        L.marker([proposal.lat, proposal.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:180px">
              <strong style="font-size:14px">${proposal.title}</strong>
              <p style="font-size:12px;margin:4px 0;color:#555">${proposal.city}</p>
              <p style="font-size:12px;color:#374151">${proposal.description}</p>
              <span style="font-size:11px;background:${proposal.status === 'approved' ? '#dcfce7' : '#dbeafe'};color:${proposal.status === 'approved' ? '#166534' : '#1e40af'};padding:2px 8px;border-radius:12px;">${proposal.status}</span>
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
  }, [proposals]);

  return (
    <div ref={mapRef} className="w-full h-[500px] rounded-xl overflow-hidden shadow-sm border border-gray-200" />
  );
}

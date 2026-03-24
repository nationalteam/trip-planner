'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS runtime objects are loaded dynamically in browser */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  isArranged: boolean;
}

interface SelectedPlace {
  placeId: string;
  title: string;
  lat: number;
  lng: number;
  city: string;
  formattedAddress: string;
  types: string[];
}

interface GoogleMapViewProps {
  proposals: Proposal[];
  canEdit: boolean;
  onAddPlace: (place: SelectedPlace) => Promise<void>;
}

const DEFAULT_CENTER = { lat: 35.6764, lng: 139.65 };
const GOOGLE_MAPS_LIBRARIES = 'places';
let mapsApiPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (mapsApiPromise) return mapsApiPromise;

  mapsApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-script="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=${GOOGLE_MAPS_LIBRARIES}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsScript = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return mapsApiPromise;
}

async function resolveGoogleMapsApiKey(): Promise<string> {
  try {
    const res = await fetch('/api/maps/config', { cache: 'no-store' });
    if (!res.ok) return '';
    const data = (await res.json()) as { apiKey?: string | null };
    return data.apiKey?.trim() || '';
  } catch {
    return '';
  }
}

function getCityFromPlace(place: any): string {
  const components = place?.address_components as Array<{ long_name?: string; types?: string[] }> | undefined;
  if (!components) return '';
  for (const component of components) {
    const types = component.types || [];
    if (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_2')) {
      return component.long_name || '';
    }
  }
  return '';
}

function toSelectedPlace(place: any): SelectedPlace | null {
  const location = place?.geometry?.location;
  if (!place?.place_id || !location?.lat || !location?.lng) return null;

  const lat = Number(location.lat());
  const lng = Number(location.lng());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    placeId: place.place_id,
    title: place.name || 'Untitled place',
    lat,
    lng,
    city: getCityFromPlace(place),
    formattedAddress: place.formatted_address || '',
    types: Array.isArray(place.types) ? place.types : [],
  };
}

export default function GoogleMapView({ proposals, canEdit, onAddPlace }: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const markerInstancesRef = useRef<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [loadingError, setLoadingError] = useState('');
  const [adding, setAdding] = useState(false);

  const normalizedProposals = useMemo(
    () => normalizeCoordinateBatch(proposals, { reference: DEFAULT_CENTER }),
    [proposals]
  );

  const clearMarkers = useCallback(() => {
    markerInstancesRef.current.forEach((marker) => marker.setMap(null));
    markerInstancesRef.current = [];
  }, []);

  const renderProposalMarkers = useCallback(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!google || !map) return;

    clearMarkers();
    normalizedProposals.forEach((proposal) => {
      const arrangedLabel = proposal.isArranged ? 'Arranged' : 'Unarranged';
      const marker = new google.maps.Marker({
        map,
        position: { lat: proposal.lat, lng: proposal.lng },
        title: proposal.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: proposal.isArranged ? '#16a34a' : '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="min-width:180px"><strong>${proposal.title}</strong><p style="margin:4px 0;color:#555">${proposal.city}</p><span style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:12px;background:${proposal.isArranged ? '#dcfce7' : '#dbeafe'};color:${proposal.isArranged ? '#166534' : '#1e40af'}">${arrangedLabel}</span></div>`,
      });
      marker.addListener('click', () => infoWindow.open({ anchor: marker, map }));
      markerInstancesRef.current.push(marker);
    });
  }, [clearMarkers, normalizedProposals]);

  useEffect(() => {
    renderProposalMarkers();
  }, [renderProposalMarkers]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      const apiKey = await resolveGoogleMapsApiKey();
      if (cancelled) return;
      if (!apiKey) {
        setLoadingError('Google Maps API key is missing. Set GOOGLE_MAPS_API_KEY.');
        return;
      }
      if (!mapRef.current || !inputRef.current) return;

      try {
        await loadGoogleMapsApi(apiKey);
      } catch {
        if (!cancelled) setLoadingError('Failed to load Google Maps. Please retry later.');
        return;
      }

      if (cancelled || !window.google || !mapRef.current || !inputRef.current) return;

      const google = window.google;
      const map = new google.maps.Map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
      });
      mapInstanceRef.current = map;
      placesServiceRef.current = new google.maps.places.PlacesService(map);
      renderProposalMarkers();

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['place_id', 'name', 'geometry', 'formatted_address', 'address_components', 'types'],
      });
      autocomplete.bindTo('bounds', map);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const normalized = toSelectedPlace(place);
        if (!normalized) return;
        setSelectedPlace(normalized);
        map.panTo({ lat: normalized.lat, lng: normalized.lng });
        map.setZoom(15);
      });

      map.addListener('click', (event: any) => {
        if (!event.placeId || !placesServiceRef.current) return;
        event.stop();
        placesServiceRef.current.getDetails(
          {
            placeId: event.placeId,
            fields: ['place_id', 'name', 'geometry', 'formatted_address', 'address_components', 'types'],
          },
          (place: any, status: string) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK) return;
            const normalized = toSelectedPlace(place);
            if (!normalized) return;
            setSelectedPlace(normalized);
          }
        );
      });
    };

    initMap();

    return () => {
      cancelled = true;
      clearMarkers();
      mapInstanceRef.current = null;
      placesServiceRef.current = null;
    };
  }, [clearMarkers, renderProposalMarkers]);

  const handleAdd = useCallback(async () => {
    if (!selectedPlace || adding || !canEdit) return;
    setAdding(true);
    try {
      await onAddPlace(selectedPlace);
      setSelectedPlace(null);
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setAdding(false);
    }
  }, [adding, canEdit, onAddPlace, selectedPlace]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search places, restaurants, hotels..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
      />
      {loadingError ? <p className="text-sm text-red-600">{loadingError}</p> : null}
      <div ref={mapRef} className="w-full h-[500px] rounded-xl overflow-hidden shadow-sm border border-gray-200" />
      {selectedPlace ? (
        <div className="border border-gray-200 rounded-lg p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{selectedPlace.title}</p>
            <p className="text-xs text-gray-500 truncate">{selectedPlace.formattedAddress || selectedPlace.city}</p>
          </div>
          <button
            type="button"
            disabled={!canEdit || adding}
            onClick={handleAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add to Proposals'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

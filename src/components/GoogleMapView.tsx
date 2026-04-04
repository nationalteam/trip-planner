'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS runtime objects are loaded dynamically in browser */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeCoordinateBatch } from '@/lib/coordinates';
import { type ItineraryRouteItem, DAY_COLORS } from '@/lib/map-activities';

interface MapActivity {
  id: string;
  title: string;
  description: string;
  type: string;
  lat: number;
  lng: number;
  city: string;
  status: string;
  isArranged: boolean;
  suggestedTime?: string;
  durationMinutes?: number | null;
  formattedAddress?: string | null;
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
  activities: MapActivity[];
  canEdit: boolean;
  onAddPlace: (place: SelectedPlace) => Promise<void>;
  focusTrigger?: number;
  itineraryRoute?: ItineraryRouteItem[];
  showItineraryRoute?: boolean;
  itineraryDayFilter?: 'all' | number;
}

const DEFAULT_CENTER = { lat: 35.6764, lng: 139.65 };
const AUTO_FIT_PADDING_PX = 56;
const AUTO_FIT_MAX_ZOOM = 15;
const SINGLE_POINT_ZOOM = 15;
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

function toLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildGoogleMapsSearchUrl(activity: MapActivity): string {
  const placeQuery = [activity.title.trim(), activity.city.trim()].filter(Boolean).join(', ');
  const query = placeQuery || `${activity.lat},${activity.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildInfoWindowContent(activity: MapActivity): string {
  const arrangedLabel = activity.isArranged ? 'Arranged' : 'Unarranged';
  const typeLabel = toLabel(activity.type);
  const timeLabel = activity.suggestedTime ? toLabel(activity.suggestedTime) : '';
  const durationLabel = typeof activity.durationMinutes === 'number' && activity.durationMinutes > 0
    ? `~${activity.durationMinutes} min`
    : '';
  const address = activity.formattedAddress?.trim() || activity.city.trim();
  const googleMapsUrl = buildGoogleMapsSearchUrl(activity);

  return `<div style="min-width:220px;max-width:280px">
    <strong style="font-size:14px;color:#111827">${activity.title || 'Untitled place'}</strong>
    <p style="margin:6px 0 0;color:#374151;font-size:12px">${[typeLabel, timeLabel].filter(Boolean).join(' · ')}</p>
    ${durationLabel ? `<p style="margin:4px 0 0;color:#6b7280;font-size:12px">${durationLabel}</p>` : ''}
    ${address ? `<p style="margin:4px 0 0;color:#6b7280;font-size:12px">${address}</p>` : ''}
    <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:12px;background:${activity.isArranged ? '#dcfce7' : '#dbeafe'};color:${activity.isArranged ? '#166534' : '#1e40af'}">${arrangedLabel}</span>
      <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#2563eb;text-decoration:underline">Open in Google Maps</a>
    </div>
  </div>`;
}

export default function GoogleMapView({ activities, canEdit, onAddPlace, focusTrigger, itineraryRoute, showItineraryRoute, itineraryDayFilter }: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const markerInstancesRef = useRef<any[]>([]);
  const routePolylineInstancesRef = useRef<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [loadingError, setLoadingError] = useState('');
  const [adding, setAdding] = useState(false);

  const mapActivities = activities;
  const normalizedActivities = useMemo(
    () => normalizeCoordinateBatch(mapActivities, { reference: DEFAULT_CENTER }),
    [mapActivities]
  );

  const clearMarkers = useCallback(() => {
    markerInstancesRef.current.forEach((marker) => marker.setMap(null));
    markerInstancesRef.current = [];
  }, []);

  const clearRoutePolylines = useCallback(() => {
    routePolylineInstancesRef.current.forEach((p) => p.setMap(null));
    routePolylineInstancesRef.current = [];
  }, []);

  const renderActivityMarkers = useCallback(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!google || !map) return;

    clearMarkers();
    normalizedActivities.forEach((activity) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: activity.lat, lng: activity.lng },
        title: activity.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: activity.isArranged ? '#16a34a' : '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      const infoWindow = new google.maps.InfoWindow({
        content: buildInfoWindowContent(activity),
      });
      marker.addListener('click', () => infoWindow.open({ anchor: marker, map }));
      markerInstancesRef.current.push(marker);
    });
  }, [clearMarkers, normalizedActivities]);

  const renderItineraryRoute = useCallback(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    clearRoutePolylines();
    if (!google || !map || !showItineraryRoute || !itineraryRoute?.length) return;

    const routeToShow = itineraryDayFilter === 'all' || itineraryDayFilter == null
      ? itineraryRoute
      : itineraryRoute.filter((item) => item.day === itineraryDayFilter);

    const byDay = new Map<number, ItineraryRouteItem[]>();
    for (const item of routeToShow) {
      if (!byDay.has(item.day)) byDay.set(item.day, []);
      byDay.get(item.day)!.push(item);
    }

    for (const [day, items] of byDay) {
      if (items.length < 2) continue;
      const path = items.map((item) => ({ lat: item.lat, lng: item.lng }));
      const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 3,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
              scale: 4,
              strokeColor: color,
              strokeWeight: 2.5,
            },
            repeat: '80px',
            offset: '0',
          },
        ],
      });
      polyline.setMap(map);
      routePolylineInstancesRef.current.push(polyline);
    }
  }, [clearRoutePolylines, itineraryDayFilter, itineraryRoute, showItineraryRoute]);

  const autoFitMapToActivities = useCallback(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!google || !map) return;

    const validActivities = normalizedActivities.filter(
      (activity) => Number.isFinite(activity.lat) && Number.isFinite(activity.lng)
    );
    if (validActivities.length === 0) return;

    if (validActivities.length === 1) {
      const activity = validActivities[0];
      map.panTo({ lat: activity.lat, lng: activity.lng });
      map.setZoom(SINGLE_POINT_ZOOM);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    validActivities.forEach((activity) => bounds.extend({ lat: activity.lat, lng: activity.lng }));
    map.fitBounds(bounds, {
      top: AUTO_FIT_PADDING_PX,
      right: AUTO_FIT_PADDING_PX,
      bottom: AUTO_FIT_PADDING_PX,
      left: AUTO_FIT_PADDING_PX,
    });
    const zoomAfterFit = typeof map.getZoom === 'function' ? map.getZoom() : null;
    if (typeof zoomAfterFit === 'number' && zoomAfterFit > AUTO_FIT_MAX_ZOOM) {
      map.setZoom(AUTO_FIT_MAX_ZOOM);
    }
  }, [normalizedActivities]);

  useEffect(() => {
    renderActivityMarkers();
  }, [renderActivityMarkers]);

  useEffect(() => {
    renderItineraryRoute();
  }, [renderItineraryRoute]);

  useEffect(() => {
    autoFitMapToActivities();
  }, [focusTrigger, autoFitMapToActivities]);

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
      renderActivityMarkers();
      renderItineraryRoute();
      autoFitMapToActivities();

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
      clearRoutePolylines();
      mapInstanceRef.current = null;
      placesServiceRef.current = null;
    };
  }, [autoFitMapToActivities, clearMarkers, clearRoutePolylines, renderActivityMarkers, renderItineraryRoute]);

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
            {adding ? 'Adding...' : 'Add to Activities'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

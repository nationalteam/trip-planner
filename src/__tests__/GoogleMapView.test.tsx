/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import GoogleMapView from '@/components/GoogleMapView';

type MarkerConstructor = jest.MockedFunction<(options: { icon: { fillColor: string } }) => unknown>;
type MapInstance = {
  addListener: jest.Mock;
  panTo: jest.Mock;
  setZoom: jest.Mock;
  fitBounds: jest.Mock;
  getZoom: jest.Mock;
};
type GoogleMapsMock = {
  maps: {
    Marker: MarkerConstructor;
    Map: jest.MockedFunction<() => MapInstance>;
    LatLngBounds: jest.MockedFunction<() => { extend: jest.Mock }>;
    InfoWindow: jest.MockedFunction<(options: { content: string }) => { open: jest.Mock }>;
  };
};

describe('GoogleMapView', () => {
  const originalFetch = global.fetch;
  let mapFactory: jest.MockedFunction<() => MapInstance>;
  let latLngBoundsFactory: jest.MockedFunction<() => { extend: jest.Mock }>;
  let infoWindowFactory: jest.MockedFunction<(options: { content: string }) => { open: jest.Mock }>;

  beforeEach(() => {
    const markerFactory = jest.fn(() => ({
      setMap: jest.fn(),
      addListener: jest.fn(),
    }));

    mapFactory = jest.fn(() => ({
      addListener: jest.fn(),
      panTo: jest.fn(),
      setZoom: jest.fn(),
      fitBounds: jest.fn(),
      getZoom: jest.fn(() => 12),
    }));
    latLngBoundsFactory = jest.fn(() => ({ extend: jest.fn() }));

    const autocompleteFactory = jest.fn(() => ({
      bindTo: jest.fn(),
      addListener: jest.fn(),
      getPlace: jest.fn(),
    }));

    infoWindowFactory = jest.fn(
      () => ({
        open: jest.fn(),
      })
    ) as jest.MockedFunction<(options: { content: string }) => { open: jest.Mock }>;

    (global as unknown as { window: Window & { google?: unknown } }).window.google = {
      maps: {
        SymbolPath: { CIRCLE: 'CIRCLE' },
        Map: mapFactory,
        Marker: markerFactory,
        LatLngBounds: latLngBoundsFactory,
        InfoWindow: infoWindowFactory,
        places: {
          Autocomplete: autocompleteFactory,
          PlacesService: jest.fn(() => ({ getDetails: jest.fn() })),
          PlacesServiceStatus: { OK: 'OK' },
        },
      },
    };

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ apiKey: 'test-key' }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('colors markers by itinerary arrangement state', async () => {
    const proposals = [
      {
        id: 'p-arranged',
        title: 'Arranged spot',
        description: 'arranged',
        type: 'place',
        lat: 35.1,
        lng: 139.1,
        city: 'Tokyo',
        status: 'pending',
        isArranged: true,
      },
      {
        id: 'p-unarranged',
        title: 'Unarranged spot',
        description: 'unarranged',
        type: 'place',
        lat: 35.2,
        lng: 139.2,
        city: 'Tokyo',
        status: 'pending',
        isArranged: false,
      },
    ];

    render(<GoogleMapView activities={proposals} canEdit onAddPlace={jest.fn()} focusTrigger={1} />);

    await waitFor(() => {
      const marker = ((window.google as unknown as GoogleMapsMock).maps.Marker);
      expect(marker).toHaveBeenCalledTimes(2);
    });

    const marker = (window.google as unknown as GoogleMapsMock).maps.Marker;
    expect(marker.mock.calls[0][0].icon.fillColor).toBe('#16a34a');
    expect(marker.mock.calls[1][0].icon.fillColor).toBe('#2563eb');

    const mapInstance = mapFactory.mock.results[0]?.value;
    expect(mapInstance.fitBounds).toHaveBeenCalled();
  });

  it('pans and zooms when only one proposal is shown', async () => {
    const proposals = [
      {
        id: 'p-single',
        title: 'Solo spot',
        description: 'single',
        type: 'place',
        lat: 35.3,
        lng: 139.3,
        city: 'Tokyo',
        status: 'pending',
        isArranged: true,
      },
    ];

    render(<GoogleMapView activities={proposals} canEdit onAddPlace={jest.fn()} focusTrigger={2} />);

    await waitFor(() => {
      const mapInstance = mapFactory.mock.results[0]?.value;
      expect(mapInstance.panTo).toHaveBeenCalledWith({ lat: 35.3, lng: 139.3 });
      expect(mapInstance.setZoom).toHaveBeenCalledWith(15);
    });
    expect(latLngBoundsFactory).not.toHaveBeenCalled();
  });

  it('renders practical info and Google Maps url in marker info window', async () => {
    const proposals = [
      {
        id: 'p-info',
        title: 'Shinjuku Gyoen',
        description: 'garden',
        type: 'place',
        lat: 35.6852,
        lng: 139.7100,
        city: 'Tokyo',
        status: 'approved',
        isArranged: true,
        suggestedTime: 'afternoon',
        durationMinutes: 90,
        formattedAddress: '11 Naitomachi, Shinjuku City, Tokyo',
      },
    ];

    render(<GoogleMapView activities={proposals} canEdit onAddPlace={jest.fn()} focusTrigger={3} />);

    await waitFor(() => {
      expect(infoWindowFactory).toHaveBeenCalled();
    });

    const infoOptions = infoWindowFactory.mock.calls[0]?.[0];
    expect(infoOptions.content).toContain('Shinjuku Gyoen');
    expect(infoOptions.content).toContain('Place');
    expect(infoOptions.content).toContain('Afternoon');
    expect(infoOptions.content).toContain('~90 min');
    expect(infoOptions.content).toContain('11 Naitomachi, Shinjuku City, Tokyo');
    expect(infoOptions.content).toContain('Arranged');
    expect(infoOptions.content).toContain('Open in Google Maps');
    expect(infoOptions.content).toContain('https://www.google.com/maps/search/?api=1&query=Shinjuku%20Gyoen%2C%20Tokyo');
  });

  it('falls back to lat,lng google maps query when title/city are missing', async () => {
    const proposals = [
      {
        id: 'p-fallback',
        title: '',
        description: 'fallback',
        type: 'place',
        lat: 35.6852,
        lng: 139.71,
        city: '',
        status: 'pending',
        isArranged: false,
      },
    ];

    render(<GoogleMapView activities={proposals} canEdit onAddPlace={jest.fn()} focusTrigger={4} />);

    await waitFor(() => {
      expect(infoWindowFactory).toHaveBeenCalled();
    });

    const infoOptions = infoWindowFactory.mock.calls[0]?.[0];
    expect(infoOptions.content).toContain('https://www.google.com/maps/search/?api=1&query=35.6852%2C139.71');
  });

});

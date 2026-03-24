/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import GoogleMapView from '@/components/GoogleMapView';

type MarkerConstructor = jest.MockedFunction<(options: { icon: { fillColor: string } }) => unknown>;
type GoogleMapsMock = {
  maps: {
    Marker: MarkerConstructor;
  };
};

describe('GoogleMapView', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const markerFactory = jest.fn(() => ({
      setMap: jest.fn(),
      addListener: jest.fn(),
    }));

    const mapFactory = jest.fn(() => ({
      addListener: jest.fn(),
      panTo: jest.fn(),
      setZoom: jest.fn(),
    }));

    const autocompleteFactory = jest.fn(() => ({
      bindTo: jest.fn(),
      addListener: jest.fn(),
      getPlace: jest.fn(),
    }));

    const infoWindowFactory = jest.fn(() => ({
      open: jest.fn(),
    }));

    (global as unknown as { window: Window & { google?: unknown } }).window.google = {
      maps: {
        SymbolPath: { CIRCLE: 'CIRCLE' },
        Map: mapFactory,
        Marker: markerFactory,
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

    render(<GoogleMapView proposals={proposals} canEdit onAddPlace={jest.fn()} />);

    await waitFor(() => {
      const marker = ((window.google as unknown as GoogleMapsMock).maps.Marker);
      expect(marker).toHaveBeenCalledTimes(2);
    });

    const marker = (window.google as unknown as GoogleMapsMock).maps.Marker;
    expect(marker.mock.calls[0][0].icon.fillColor).toBe('#16a34a');
    expect(marker.mock.calls[1][0].icon.fillColor).toBe('#2563eb');
  });
});

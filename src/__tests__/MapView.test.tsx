/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import MapView from '@/components/MapView';

const mockRemove = jest.fn();
const mockAddTo = jest.fn();
const mockSetView = jest.fn();
const mockBindPopup = jest.fn();
const mockMarker = jest.fn();
const mockDivIcon = jest.fn();
const mockTileLayer = jest.fn();
const mockMap = jest.fn();
const mockMergeOptions = jest.fn();

const markerInstance = {
  addTo: mockAddTo.mockReturnThis(),
  bindPopup: mockBindPopup.mockReturnThis(),
};

const mapInstance = {
  remove: mockRemove,
  setView: mockSetView.mockReturnThis(),
};

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    map: mockMap.mockReturnValue(mapInstance),
    tileLayer: mockTileLayer.mockReturnValue({ addTo: jest.fn() }),
    divIcon: mockDivIcon.mockReturnValue({}),
    marker: mockMarker.mockReturnValue(markerInstance),
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: mockMergeOptions,
      },
    },
  },
}));

jest.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true });

const baseProposal = {
  id: 'p-1',
  title: 'Ise Grand Shrine',
  description: 'A famous Shinto shrine.',
  type: 'place',
  lat: 34.4548,
  lng: 136.7253,
  city: 'Ise',
  status: 'approved',
};

describe('MapView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMap.mockReturnValue(mapInstance);
    mockAddTo.mockReturnValue(markerInstance);
    mockBindPopup.mockReturnValue(markerInstance);
    mockSetView.mockReturnValue(mapInstance);
  });

  it('renders the map container div', () => {
    const { container } = render(<MapView activities={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('initialises the Leaflet map when activities are provided', async () => {
    await act(async () => {
      render(<MapView activities={[baseProposal]} />);
    });

    expect(mockMap).toHaveBeenCalledTimes(1);
  });

  it('creates a marker for each valid approved activity', async () => {
    const activities = [
      { ...baseProposal, id: 'p-1' },
      { ...baseProposal, id: 'p-2', title: 'Toba Aquarium', lat: 34.4833, lng: 136.8333 },
    ];

    await act(async () => {
      render(<MapView activities={activities} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(2);
  });

  it('skips activities with non-finite coordinates', async () => {
    const activities = [
      baseProposal,
      { ...baseProposal, id: 'p-bad', lat: NaN, lng: NaN },
    ];

    await act(async () => {
      render(<MapView activities={activities} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith([34.4548, 136.7253], expect.anything());
  });

  it('normalizes obviously swapped latitude/longitude before rendering marker', async () => {
    const activities = [
      { ...baseProposal, id: 'p-swapped', lat: 136.7253, lng: 34.4548 },
    ];

    await act(async () => {
      render(<MapView activities={activities} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith([34.4548, 136.7253], expect.anything());
  });

  it('normalizes ambiguously swapped coordinates using unambiguous batch anchors', async () => {
    // p-anchor has lng=-100 (|lng|>90) so its swapped form lat=-100 is invalid → unambiguous anchor
    // p-ambiguous-swapped has both values in [-90,90] → ambiguous; resolved via anchor centroid
    const activities = [
      { ...baseProposal, id: 'p-anchor', lat: 50, lng: -100 },
      { ...baseProposal, id: 'p-ambiguous-swapped', lat: -40, lng: 50 },
    ];

    await act(async () => {
      render(<MapView activities={activities} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(2);
    expect(mockMarker).toHaveBeenNthCalledWith(1, [50, -100], expect.anything());
    expect(mockMarker).toHaveBeenNthCalledWith(2, [50, -40], expect.anything());
  });

  it('shows only approved activities when some are approved', async () => {
    const activities = [
      { ...baseProposal, id: 'p-approved', status: 'approved' },
      { ...baseProposal, id: 'p-pending', status: 'pending', title: 'Pending Place' },
    ];

    await act(async () => {
      render(<MapView activities={activities} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith([34.4548, 136.7253], expect.anything());
  });

  it('shows all valid activities when none are approved', async () => {
    const activities = [
      { ...baseProposal, id: 'p-1', status: 'pending' },
      { ...baseProposal, id: 'p-2', status: 'pending', title: 'Another Place' },
    ];

    await act(async () => {
      render(<MapView activities={activities} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(2);
  });

  it('removes the map on unmount', async () => {
    let unmount!: () => void;

    await act(async () => {
      const result = render(<MapView activities={[baseProposal]} />);
      unmount = result.unmount;
    });

    act(() => {
      unmount();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('reinitialises the map when activities change', async () => {
    const { rerender } = render(<MapView activities={[baseProposal]} />);

    await act(async () => {
      await Promise.resolve();
    });

    const updated = [
      baseProposal,
      { ...baseProposal, id: 'p-new', title: 'New Place', lat: 34.49, lng: 136.83 },
    ];

    await act(async () => {
      rerender(<MapView activities={updated} />);
    });

    expect(mockRemove).toHaveBeenCalled();
    expect(mockMap).toHaveBeenCalledTimes(2);
  });

  it('does not create markers when activities list is empty', async () => {
    await act(async () => {
      render(<MapView activities={[]} />);
    });

    expect(mockMarker).not.toHaveBeenCalled();
  });

});

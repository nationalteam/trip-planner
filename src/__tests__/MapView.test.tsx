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
    const { container } = render(<MapView proposals={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('initialises the Leaflet map when proposals are provided', async () => {
    await act(async () => {
      render(<MapView proposals={[baseProposal]} />);
    });

    expect(mockMap).toHaveBeenCalledTimes(1);
  });

  it('creates a marker for each valid approved proposal', async () => {
    const proposals = [
      { ...baseProposal, id: 'p-1' },
      { ...baseProposal, id: 'p-2', title: 'Toba Aquarium', lat: 34.4833, lng: 136.8333 },
    ];

    await act(async () => {
      render(<MapView proposals={proposals} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(2);
  });

  it('skips proposals with non-finite coordinates', async () => {
    const proposals = [
      baseProposal,
      { ...baseProposal, id: 'p-bad', lat: NaN, lng: NaN },
    ];

    await act(async () => {
      render(<MapView proposals={proposals} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith([34.4548, 136.7253], expect.anything());
  });

  it('normalizes obviously swapped latitude/longitude before rendering marker', async () => {
    const proposals = [
      { ...baseProposal, id: 'p-swapped', lat: 136.7253, lng: 34.4548 },
    ];

    await act(async () => {
      render(<MapView proposals={proposals} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith([34.4548, 136.7253], expect.anything());
  });

  it('normalizes ambiguously swapped coordinates using nearby anchor points', async () => {
    const proposals = [
      { ...baseProposal, id: 'p-anchor', lat: 48.8566, lng: 2.3522, city: 'Paris' },
      { ...baseProposal, id: 'p-ambiguous-swapped', lat: 2.3508, lng: 48.8567, city: 'Paris' },
    ];

    await act(async () => {
      render(<MapView proposals={proposals} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(2);
    expect(mockMarker).toHaveBeenNthCalledWith(1, [48.8566, 2.3522], expect.anything());
    expect(mockMarker).toHaveBeenNthCalledWith(2, [48.8567, 2.3508], expect.anything());
  });

  it('shows only approved proposals when some are approved', async () => {
    const proposals = [
      { ...baseProposal, id: 'p-approved', status: 'approved' },
      { ...baseProposal, id: 'p-pending', status: 'pending', title: 'Pending Place' },
    ];

    await act(async () => {
      render(<MapView proposals={proposals} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(1);
    expect(mockMarker).toHaveBeenCalledWith([34.4548, 136.7253], expect.anything());
  });

  it('shows all valid proposals when none are approved', async () => {
    const proposals = [
      { ...baseProposal, id: 'p-1', status: 'pending' },
      { ...baseProposal, id: 'p-2', status: 'pending', title: 'Another Place' },
    ];

    await act(async () => {
      render(<MapView proposals={proposals} />);
    });

    expect(mockMarker).toHaveBeenCalledTimes(2);
  });

  it('removes the map on unmount', async () => {
    let unmount!: () => void;

    await act(async () => {
      const result = render(<MapView proposals={[baseProposal]} />);
      unmount = result.unmount;
    });

    act(() => {
      unmount();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('reinitialises the map when proposals change', async () => {
    const { rerender } = render(<MapView proposals={[baseProposal]} />);

    await act(async () => {
      await Promise.resolve();
    });

    const updated = [
      baseProposal,
      { ...baseProposal, id: 'p-new', title: 'New Place', lat: 34.49, lng: 136.83 },
    ];

    await act(async () => {
      rerender(<MapView proposals={updated} />);
    });

    expect(mockRemove).toHaveBeenCalled();
    expect(mockMap).toHaveBeenCalledTimes(2);
  });

  it('does not create markers when proposals list is empty', async () => {
    await act(async () => {
      render(<MapView proposals={[]} />);
    });

    expect(mockMarker).not.toHaveBeenCalled();
  });
});

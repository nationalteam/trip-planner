/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import TripCard from '@/components/TripCard';

const baseTrip = {
  id: 'trip-1',
  name: 'Summer Vacation',
  cities: JSON.stringify(['Paris', 'Tokyo']),
  createdAt: '2024-06-15T00:00:00.000Z',
};

describe('TripCard', () => {
  it('renders the trip name', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.getByText('Summer Vacation')).toBeInTheDocument();
  });

  it('renders each city as a badge', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.getByText(/Paris/)).toBeInTheDocument();
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument();
  });

  it('renders the formatted creation date', () => {
    render(<TripCard trip={baseTrip} />);
    // The date is formatted as "Jun 15, 2024" (locale-dependent but deterministic)
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('renders proposal and itinerary counts when _count is provided', () => {
    const tripWithCount = {
      ...baseTrip,
      _count: { proposals: 5, itineraryItems: 3 },
    };
    render(<TripCard trip={tripWithCount} />);
    expect(screen.getByText('5 proposals')).toBeInTheDocument();
    expect(screen.getByText('3 planned')).toBeInTheDocument();
  });

  it('does not render counts when _count is absent', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.queryByText(/proposals/)).not.toBeInTheDocument();
    expect(screen.queryByText(/planned/)).not.toBeInTheDocument();
  });

  it('links to the correct trip detail page', () => {
    render(<TripCard trip={baseTrip} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/trips/trip-1');
  });

  it('renders the airplane emoji icon', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.getByText('✈️')).toBeInTheDocument();
  });
});

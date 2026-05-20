/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import TripCard from '@/components/TripCard';

const baseTrip = {
  id: 'trip-1',
  name: 'Summer Vacation',
  cities: JSON.stringify(['Paris', 'Tokyo']),
  createdAt: '2024-06-15T00:00:00.000Z',
  startDate: null,
  durationDays: null,
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

  it('renders activity and itinerary counts when counts is provided', () => {
    const tripWithCount = {
      ...baseTrip,
      counts: { activitiesCount: 5, itineraryItemsCount: 3 },
    };
    render(<TripCard trip={tripWithCount} />);
    expect(screen.getByText('5 activities')).toBeInTheDocument();
    expect(screen.getByText('3 planned')).toBeInTheDocument();
  });

  it('does not render counts when counts is absent', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.queryByText(/activities/)).not.toBeInTheDocument();
    expect(screen.queryByText(/planned/)).not.toBeInTheDocument();
  });

  it('renders flexible schedule when date info is absent', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.getByText('Flexible schedule')).toBeInTheDocument();
  });

  it('renders start date and duration when provided', () => {
    render(<TripCard trip={{ ...baseTrip, startDate: '2026-04-01', durationDays: 7 }} />);
    expect(screen.getByText('Start 2026-04-01')).toBeInTheDocument();
    expect(screen.getByText('7 days')).toBeInTheDocument();
  });

  it('links to the correct trip detail page', () => {
    render(<TripCard trip={baseTrip} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/trips/trip-1');
  });

  it('renders professional planning status cues', () => {
    render(<TripCard trip={{ ...baseTrip, counts: { activitiesCount: 5, itineraryItemsCount: 3 } }} />);
    expect(screen.getByText('Private dossier')).toBeInTheDocument();
    expect(screen.getByText('60% planned')).toBeInTheDocument();
  });

  it('renders a concierge next move for each dossier card', () => {
    render(<TripCard trip={{ ...baseTrip, counts: { activitiesCount: 5, itineraryItemsCount: 3 } }} />);
    expect(screen.getByText('Next move')).toBeInTheDocument();
    expect(screen.getByText('Frame the trip dates')).toBeInTheDocument();
    expect(screen.getByText('Add dates or duration so pacing, weather, and route decisions can be trusted.')).toBeInTheDocument();
  });

  it('renders the airplane emoji icon', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.getByText('✈️')).toBeInTheDocument();
  });

  it('does not render a delete button', () => {
    render(<TripCard trip={baseTrip} />);
    expect(screen.queryByRole('button', { name: /delete trip/i })).not.toBeInTheDocument();
  });
});

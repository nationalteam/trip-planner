/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ItineraryView from '@/components/ItineraryView';

const makeItem = (overrides: Partial<{
  id: string;
  day: number;
  timeBlock: string;
  proposalType: string;
  proposalTitle: string;
  proposalDescription: string;
  proposalCity: string;
  proposalDuration: number | null;
}> = {}) => ({
  id: overrides.id ?? 'item-1',
  day: overrides.day ?? 1,
  timeBlock: overrides.timeBlock ?? 'morning',
  proposal: {
    id: 'proposal-1',
    title: overrides.proposalTitle ?? 'Eiffel Tower',
    description: overrides.proposalDescription ?? 'Iconic landmark',
    type: overrides.proposalType ?? 'place',
    city: overrides.proposalCity ?? 'Paris',
    durationMinutes: overrides.proposalDuration === undefined ? 60 : overrides.proposalDuration,
    suggestedTime: 'morning',
  },
});

describe('ItineraryView', () => {
  it('shows an empty state message when there are no items', () => {
    render(<ItineraryView items={[]} />);
    expect(screen.getByText(/No itinerary items yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Approve proposals to build your itinerary/i)).toBeInTheDocument();
  });

  it('renders a day heading for each day in the itinerary', () => {
    const items = [
      makeItem({ id: 'item-1', day: 1 }),
      makeItem({ id: 'item-2', day: 2 }),
    ];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
  });

  it('renders the proposal title and description', () => {
    const items = [makeItem({ proposalTitle: 'Louvre Museum', proposalDescription: 'World famous art museum' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('Louvre Museum')).toBeInTheDocument();
    expect(screen.getByText('World famous art museum')).toBeInTheDocument();
  });

  it('renders the city name for a proposal', () => {
    const items = [makeItem({ proposalCity: 'Paris' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('renders duration when present', () => {
    const items = [makeItem({ proposalDuration: 120 })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/120min/)).toBeInTheDocument();
  });

  it('does not render duration when durationMinutes is null', () => {
    const items = [makeItem({ proposalDuration: null })];
    render(<ItineraryView items={items} />);
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it('renders the correct time block label for morning', () => {
    const items = [makeItem({ timeBlock: 'morning' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Morning/i)).toBeInTheDocument();
  });

  it('renders the correct time block label for afternoon', () => {
    const items = [makeItem({ timeBlock: 'afternoon' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Afternoon/i)).toBeInTheDocument();
  });

  it('renders the correct time block label for dinner/evening', () => {
    const items = [makeItem({ timeBlock: 'dinner' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText(/Evening/i)).toBeInTheDocument();
  });

  it('groups multiple time blocks within the same day', () => {
    const items = [
      makeItem({ id: 'a', day: 1, timeBlock: 'morning' }),
      makeItem({ id: 'b', day: 1, timeBlock: 'afternoon', proposalTitle: 'Afternoon café' }),
    ];
    render(<ItineraryView items={items} />);
    // Only one Day 1 heading
    expect(screen.getAllByText('Day 1')).toHaveLength(1);
    expect(screen.getByText(/Morning/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Afternoon/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Afternoon café')).toBeInTheDocument();
  });

  it('renders food type icon', () => {
    const items = [makeItem({ proposalType: 'food' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('🍽️')).toBeInTheDocument();
  });

  it('renders place type icon', () => {
    const items = [makeItem({ proposalType: 'place' })];
    render(<ItineraryView items={items} />);
    expect(screen.getByText('🏛️')).toBeInTheDocument();
  });

  it('sorts days in ascending order', () => {
    const items = [
      makeItem({ id: 'c', day: 3, proposalTitle: 'Day 3 item' }),
      makeItem({ id: 'a', day: 1, proposalTitle: 'Day 1 item' }),
      makeItem({ id: 'b', day: 2, proposalTitle: 'Day 2 item' }),
    ];
    render(<ItineraryView items={items} />);
    const days = screen.getAllByText(/^Day \d+$/);
    expect(days[0]).toHaveTextContent('Day 1');
    expect(days[1]).toHaveTextContent('Day 2');
    expect(days[2]).toHaveTextContent('Day 3');
  });
});

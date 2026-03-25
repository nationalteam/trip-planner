/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivityCard from '@/components/ActivityCard';

const baseActivity = {
  id: 'activity-1',
  type: 'food',
  title: 'Le Petit Bistro',
  description: 'A cozy French bistro in the heart of Paris.',
  reason: 'Matches your love for French cuisine.',
  lat: 48.865,
  lng: 2.321,
  city: 'Paris',
  suggestedTime: 'dinner',
  durationMinutes: 90,
  status: 'pending',
};

describe('ActivityCard', () => {
  const onApprove = jest.fn();
  const onReject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the activity title', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('Le Petit Bistro')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('A cozy French bistro in the heart of Paris.')).toBeInTheDocument();
  });

  it('renders the reason', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText(/Matches your love for French cuisine/)).toBeInTheDocument();
  });

  it('renders the city and suggested time', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    // The city + time span contains both values together
    expect(screen.getByText(/Paris · 🌙/)).toBeInTheDocument();
    expect(screen.getByText(/dinner/)).toBeInTheDocument();
  });

  it('renders duration when present', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText(/90 minutes/)).toBeInTheDocument();
  });

  it('does not render duration when durationMinutes is null', () => {
    const activity = { ...baseActivity, durationMinutes: null };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByText(/minutes/)).not.toBeInTheDocument();
  });

  it('renders a Google Maps link using activity title and city', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    const link = screen.getByRole('link', { name: /open in google maps/i });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Le%20Petit%20Bistro%2C%20Paris');
  });

  it('falls back to coordinates for Google Maps link when title and city are blank', () => {
    const activity = { ...baseActivity, title: '   ', city: '   ' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    const link = screen.getByRole('link', { name: /open in google maps/i });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=48.865%2C2.321');
  });

  it('shows Approve and Reject buttons when status is pending', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('does not show action buttons when status is approved', () => {
    const activity = { ...baseActivity, status: 'approved' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  it('does not show action buttons when status is rejected', () => {
    const activity = { ...baseActivity, status: 'rejected' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  it('calls onApprove with the activity id when Approve is clicked', async () => {
    const user = userEvent.setup();
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    await user.click(screen.getByRole('button', { name: /Approve/i }));
    expect(onApprove).toHaveBeenCalledWith('activity-1');
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onReject with the activity id when Reject is clicked', async () => {
    const user = userEvent.setup();
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    await user.click(screen.getByRole('button', { name: /Reject/i }));
    expect(onReject).toHaveBeenCalledWith('activity-1');
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('shows pending status badge', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows approved status badge', () => {
    const activity = { ...baseActivity, status: 'approved' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('shows rejected status badge', () => {
    const activity = { ...baseActivity, status: 'rejected' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('renders food type icon', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('🍽️')).toBeInTheDocument();
  });

  it('renders place type icon for place activities', () => {
    const activity = { ...baseActivity, type: 'place' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('🏛️')).toBeInTheDocument();
  });

  it('renders hotel type icon for hotel activities', () => {
    const activity = { ...baseActivity, type: 'hotel' };
    render(<ActivityCard activity={activity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('🏨')).toBeInTheDocument();
  });

  it('does not render a delete button when onDelete is not provided', () => {
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByRole('button', { name: /delete activity/i })).not.toBeInTheDocument();
  });

  it('renders a delete button when onDelete is provided', () => {
    const onDelete = jest.fn();
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />);
    expect(screen.getByRole('button', { name: /delete activity/i })).toBeInTheDocument();
  });

  it('calls onDelete with the activity id when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(<ActivityCard activity={baseActivity} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /delete activity/i }));
    expect(onDelete).toHaveBeenCalledWith('activity-1');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

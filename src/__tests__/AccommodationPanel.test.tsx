/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccommodationPanel from '@/components/AccommodationPanel';

describe('AccommodationPanel', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 'acc-1',
          tripId: 'trip-1',
          name: 'Hotel A',
          address: 'Address A',
          lat: null,
          lng: null,
          checkInDate: '2026-04-01',
          checkOutDate: '2026-04-03',
          notes: null,
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
        },
      ]),
    }) as jest.Mock;
  });

  it('shows daily stay mapping from accommodations', async () => {
    render(
      <AccommodationPanel
        tripId="trip-1"
        canEdit={false}
        startDate="2026-04-01"
        durationDays={3}
      />
    );

    await waitFor(() => expect(screen.getAllByText('Hotel A').length).toBeGreaterThan(0));
    expect(screen.getByText('Day 1 · 2026-04-01')).toBeInTheDocument();
    expect(screen.getByText('Day 2 · 2026-04-02')).toBeInTheDocument();
    expect(screen.getByText('Day 3 · 2026-04-03')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows schedule hint when trip schedule is missing', async () => {
    render(<AccommodationPanel tripId="trip-1" canEdit={false} startDate={null} durationDays={null} />);

    await waitFor(() => expect(screen.getAllByText('Hotel A').length).toBeGreaterThan(0));
    expect(screen.getByText(/Set trip start date and duration/i)).toBeInTheDocument();
  });

  it('shows validation error instead of silently blocking when required dates are missing', async () => {
    const user = userEvent.setup();
    render(<AccommodationPanel tripId="trip-1" canEdit startDate={null} durationDays={null} />);

    await waitFor(() => expect(screen.getAllByText('Hotel A').length).toBeGreaterThan(0));
    await user.type(screen.getByPlaceholderText('Accommodation name'), 'Hotel B');
    await user.type(screen.getByPlaceholderText('Address'), 'Address B');
    await user.click(screen.getByRole('button', { name: 'Add stay' }));

    expect(screen.getByText('name, address, checkInDate, and checkOutDate are required.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

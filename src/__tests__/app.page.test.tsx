/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '@/app/page';

describe('Home page', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not crash when /api/trips returns a non-array payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ error: 'Unauthorized' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('No trips yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('My Trips')).toBeInTheDocument();
  });
});

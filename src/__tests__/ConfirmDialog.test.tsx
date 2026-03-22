/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    render(
      <ConfirmDialog open={false} message="Are you sure?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('renders the message when open is true', () => {
    render(
      <ConfirmDialog open={true} message="Are you sure?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders Confirm and Cancel buttons when open', () => {
    render(
      <ConfirmDialog open={true} message="Delete this item?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog open={true} message="Delete this item?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog open={true} message="Delete this item?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when overlay backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog open={true} message="Delete this item?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    await user.click(screen.getByTestId('confirm-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

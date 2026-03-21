/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalCard from '@/components/ProposalCard';

const baseProposal = {
  id: 'proposal-1',
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

describe('ProposalCard', () => {
  const onApprove = jest.fn();
  const onReject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the proposal title', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('Le Petit Bistro')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('A cozy French bistro in the heart of Paris.')).toBeInTheDocument();
  });

  it('renders the reason', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText(/Matches your love for French cuisine/)).toBeInTheDocument();
  });

  it('renders the city and suggested time', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    // The city + time span contains both values together
    expect(screen.getByText(/Paris · 🌙/)).toBeInTheDocument();
    expect(screen.getByText(/dinner/)).toBeInTheDocument();
  });

  it('renders duration when present', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText(/90 minutes/)).toBeInTheDocument();
  });

  it('does not render duration when durationMinutes is null', () => {
    const proposal = { ...baseProposal, durationMinutes: null };
    render(<ProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByText(/minutes/)).not.toBeInTheDocument();
  });

  it('shows Approve and Reject buttons when status is pending', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('does not show action buttons when status is approved', () => {
    const proposal = { ...baseProposal, status: 'approved' };
    render(<ProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  it('does not show action buttons when status is rejected', () => {
    const proposal = { ...baseProposal, status: 'rejected' };
    render(<ProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  it('calls onApprove with the proposal id when Approve is clicked', async () => {
    const user = userEvent.setup();
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    await user.click(screen.getByRole('button', { name: /Approve/i }));
    expect(onApprove).toHaveBeenCalledWith('proposal-1');
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onReject with the proposal id when Reject is clicked', async () => {
    const user = userEvent.setup();
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    await user.click(screen.getByRole('button', { name: /Reject/i }));
    expect(onReject).toHaveBeenCalledWith('proposal-1');
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('shows pending status badge', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows approved status badge', () => {
    const proposal = { ...baseProposal, status: 'approved' };
    render(<ProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('shows rejected status badge', () => {
    const proposal = { ...baseProposal, status: 'rejected' };
    render(<ProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('renders food type icon', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('🍽️')).toBeInTheDocument();
  });

  it('renders place type icon for place proposals', () => {
    const proposal = { ...baseProposal, type: 'place' };
    render(<ProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.getByText('🏛️')).toBeInTheDocument();
  });

  it('does not render a delete button when onDelete is not provided', () => {
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByRole('button', { name: /delete proposal/i })).not.toBeInTheDocument();
  });

  it('renders a delete button when onDelete is provided', () => {
    const onDelete = jest.fn();
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />);
    expect(screen.getByRole('button', { name: /delete proposal/i })).toBeInTheDocument();
  });

  it('calls onDelete with the proposal id when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(<ProposalCard proposal={baseProposal} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /delete proposal/i }));
    expect(onDelete).toHaveBeenCalledWith('proposal-1');
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

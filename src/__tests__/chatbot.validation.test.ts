jest.mock('@/lib/prisma', () => ({
  prisma: {},
}));

jest.mock('@/lib/llm', () => ({
  fillProposalDetails: jest.fn(),
  generateChatActionPlan: jest.fn(),
  generateProposals: jest.fn(),
  organizeItinerary: jest.fn(),
}));

jest.mock('@/lib/geocoding', () => ({
  geocodeWithGoogleMaps: jest.fn(),
}));

import { validateChatAction, validateChatActionPlan } from '@/lib/chatbot';

describe('chatbot action validation with activity naming', () => {
  it('accepts activity.create payload with activityType', () => {
    const action = validateChatAction({
      type: 'activity.create',
      title: 'Eiffel Tower',
      description: 'Landmark',
      city: 'Paris',
      activityType: 'place',
    });

    expect(action).toMatchObject({
      type: 'activity.create',
      title: 'Eiffel Tower',
      activityType: 'place',
    });
  });

  it('accepts legacy proposal.create payload and normalizes to activity.create', () => {
    const action = validateChatAction({
      type: 'proposal.create',
      title: 'Louvre Museum',
      description: 'Museum',
      city: 'Paris',
      proposalType: 'place',
    });

    expect(action).toMatchObject({
      type: 'activity.create',
      title: 'Louvre Museum',
      activityType: 'place',
    });
  });

  it('accepts itinerary.addActivity with activityId', () => {
    const action = validateChatAction({
      type: 'itinerary.addActivity',
      activityId: 'a-1',
      day: 2,
      timeBlock: 'afternoon',
      order: 1,
    });

    expect(action).toEqual({
      type: 'itinerary.addActivity',
      activityId: 'a-1',
      day: 2,
      timeBlock: 'afternoon',
      order: 1,
    });
  });

  it('accepts legacy itinerary.addProposal payload and normalizes to itinerary.addActivity', () => {
    const action = validateChatAction({
      type: 'itinerary.addProposal',
      proposalId: 'p-legacy',
      day: 1,
      timeBlock: 'morning',
    });

    expect(action).toEqual({
      type: 'itinerary.addActivity',
      activityId: 'p-legacy',
      day: 1,
      timeBlock: 'morning',
      order: undefined,
    });
  });

  it('requires activityId for activity.update after normalization', () => {
    expect(() => validateChatAction({ type: 'proposal.update', title: 'new title' }))
      .toThrow('activity.update requires activityId.');
  });

  it('normalizes action plan item types to activity naming', () => {
    const plan = validateChatActionPlan([
      { type: 'proposal.generate', city: 'Paris' },
      { type: 'proposal.delete', proposalId: 'p-1' },
    ]);

    expect(plan).toEqual([
      { type: 'activity.generate', city: 'Paris' },
      { type: 'activity.delete', activityId: 'p-1' },
    ]);
  });
});

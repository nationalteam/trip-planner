jest.mock('@/lib/prisma', () => ({
  prisma: {},
}));

jest.mock('@/lib/llm', () => ({
  fillActivityDetails: jest.fn(),
  generateChatActionPlan: jest.fn(),
  generateActivities: jest.fn(),
  organizeItinerary: jest.fn(),
}));

jest.mock('@/lib/geocoding', () => ({
  geocodeWithGoogleMaps: jest.fn(),
}));

import { validateChatAction, validateChatActionPlan } from '@/lib/chatbot';
import * as chatbotModule from '@/lib/chatbot';

describe('chatbot action validation with activity naming', () => {
  it('does not expose legacy suggestProposalCreateActionFromTitle export', () => {
    expect('suggestProposalCreateActionFromTitle' in chatbotModule).toBe(false);
  });

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

  it('rejects legacy proposal.create payload', () => {
    expect(() => validateChatAction({
      type: 'proposal.create',
      title: 'Louvre Museum',
      description: 'Museum',
      city: 'Paris',
      proposalType: 'place',
    })).toThrow('Unsupported action type.');
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

  it('rejects legacy itinerary.addProposal payload', () => {
    expect(() => validateChatAction({
      type: 'itinerary.addProposal',
      proposalId: 'p-legacy',
      day: 1,
      timeBlock: 'morning',
    })).toThrow('Unsupported action type.');
  });

  it('requires activityId for activity.update', () => {
    expect(() => validateChatAction({ type: 'activity.update', title: 'new title' }))
      .toThrow('activity.update requires activityId.');
  });

  it('rejects legacy action plan item types', () => {
    expect(() => validateChatActionPlan([
      { type: 'proposal.generate', city: 'Paris' },
      { type: 'proposal.delete', proposalId: 'p-1' },
    ])).toThrow('Unsupported action type.');
  });
});

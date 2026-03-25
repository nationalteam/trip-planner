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
  it('exposes activity create suggestion helper', () => {
    expect('suggestActivityCreateActionFromTitle' in chatbotModule).toBe(true);
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

  it('rejects activity.create payload with unsupported legacy type alias field', () => {
    expect(() => validateChatAction({
      type: 'activity.create',
      title: 'Eiffel Tower',
      description: 'Landmark',
      city: 'Paris',
      legacyType: 'place',
    })).toThrow('Unsupported field "legacyType"');
  });

  it('rejects legacy create action payload', () => {
    expect(() => validateChatAction({
      type: 'legacy.create',
      title: 'Louvre Museum',
      description: 'Museum',
      city: 'Paris',
      legacyType: 'place',
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

  it('rejects legacy itinerary.add action payload', () => {
    expect(() => validateChatAction({
      type: 'itinerary.addLegacy',
      activityId: 'x-legacy',
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
      { type: 'legacy.generate', city: 'Paris' },
      { type: 'legacy.delete', activityId: 'x-1' },
    ])).toThrow('Unsupported action type.');
  });
});

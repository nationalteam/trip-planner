const mockCreate = jest.fn();

jest.mock('openai', () => {
  const mockClientFactory = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  return {
    __esModule: true,
    default: mockClientFactory,
    AzureOpenAI: mockClientFactory,
  };
});

import { generateActivities, organizeItinerary, fillActivityDetails, generateChatActionPlan } from '@/lib/llm';
import OpenAI from 'openai';

describe('generateActivities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns parsed activities from the LLM response', async () => {
    const fakeActivities = [
      {
        type: 'food',
        title: 'Le Bistro',
        description: 'Great food',
        reason: 'You like French',
        city: 'Paris',
        suggestedTime: 'dinner',
        durationMinutes: 90,
      },
    ];

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fakeActivities) } }],
    });

    const result = await generateActivities([], 'Paris');
    expect(result).toEqual(fakeActivities);
  });

  it('extracts JSON array from response that contains extra text', async () => {
    const fakeActivities = [{ type: 'place', title: 'Louvre', description: 'Museum', reason: 'Art', lat: 48.86, lng: 2.33, city: 'Paris', suggestedTime: 'morning', durationMinutes: 120 }];
    const responseWithExtraText = `Here are some activities:\n${JSON.stringify(fakeActivities)}\nEnjoy!`;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: responseWithExtraText } }],
    });

    const result = await generateActivities([], 'Paris');
    expect(result).toEqual(fakeActivities);
  });

  it('returns an empty array when JSON parsing fails entirely', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'This is not JSON at all.' } }],
    });

    const result = await generateActivities([], 'Paris');
    expect(result).toEqual([]);
  });

  it('returns an empty array when response content is null', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await generateActivities([], 'Paris');
    expect(result).toEqual([]);
  });

  it('includes existing activity titles in the prompt context to avoid duplicates', async () => {
    const existingProposals = [{ title: 'Eiffel Tower' }];

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris', existingProposals);

    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain('Eiffel Tower');
  });

  it('passes preferences to the LLM prompt', async () => {
    const preferences = [{ likes: 'sushi', dislikes: 'spicy', budget: 'medium', preferredLanguage: 'ja' }];
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities(preferences, 'Tokyo');

    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain('sushi');
    expect(promptContent).toContain('Tokyo');
    expect(promptContent).toContain('preferredLanguage');
    expect(promptContent).toContain('ja');
  });

  it('does not ask the LLM to generate lat/lng fields', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).not.toContain('"lat"');
    expect(promptContent).not.toContain('"lng"');
    expect(promptContent).toContain('"city"');
  });

  it('uses gpt-5-mini as the default OpenAI model when OPENAI_MODEL is not set', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    delete process.env.OPENAI_MODEL;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.BIFROST_API_KEY;

    await generateActivities([], 'Paris');
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('gpt-5-mini');
  });

  it('uses gpt-5-mini as the default Bifrost model when OPENAI_MODEL is not set', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080';
    delete process.env.OPENAI_MODEL;
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-5-mini');
  });

  it('uses Bifrost OpenAI-compatible endpoint when LLM_PROVIDER is bifrost', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_API_KEY = 'bf-key';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080';
    process.env.OPENAI_MODEL = 'gpt-4.1-mini';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'bf-key',
      baseURL: 'http://127.0.0.1:8080/openai/v1',
    });
    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-4.1-mini');
  });

  it('uses default Bifrost base URL when BIFROST_BASE_URL is not set', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_API_KEY = 'bf-key';
    delete process.env.BIFROST_BASE_URL;
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'bf-key',
      baseURL: 'http://127.0.0.1:8080/openai/v1',
    });
  });

  it('normalizes Bifrost base URL that already ends with /openai', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_API_KEY = 'bf-key';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080/openai';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'bf-key',
      baseURL: 'http://127.0.0.1:8080/openai/v1',
    });
  });

  it('does not double-append when Bifrost base URL already ends with /openai/v1', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_API_KEY = 'bf-key';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080/openai/v1';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'bf-key',
      baseURL: 'http://127.0.0.1:8080/openai/v1',
    });
  });

  it('preserves Bifrost base URL that already ends with /v1', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_API_KEY = 'bf-key';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080/v1';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'bf-key',
      baseURL: 'http://127.0.0.1:8080/v1',
    });
  });
  it('uses empty API key when LLM_PROVIDER is bifrost and BIFROST_API_KEY is missing', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    delete process.env.BIFROST_API_KEY;
    process.env.BIFROST_BASE_URL = 'http://192.168.1.200:8080';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: '',
      baseURL: 'http://192.168.1.200:8080/openai/v1',
    });
  });

  it('throws a clear message for Bifrost auth errors', async () => {
    process.env.LLM_PROVIDER = 'bifrost';
    process.env.BIFROST_API_KEY = 'invalid';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080';
    mockCreate.mockRejectedValue({
      status: 401,
      message: 'unauthorized',
    });

    await expect(generateActivities([], 'Paris')).rejects.toThrow('Bifrost authentication failed. Check BIFROST_API_KEY.');
  });

  it('uses OpenAI first when LLM_PROVIDER is unset and multiple provider envs are present', async () => {
    delete process.env.LLM_PROVIDER;
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example-resource.openai.azure.com/openai/v1';
    process.env.BIFROST_API_KEY = 'bf-key';
    process.env.BIFROST_BASE_URL = 'http://127.0.0.1:8080';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateActivities([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'openai-key',
    });
  });

  it('throws when LLM_PROVIDER is unsupported', async () => {
    process.env.LLM_PROVIDER = 'invalid-provider';
    await expect(generateActivities([], 'Paris')).rejects.toThrow('Unsupported LLM_PROVIDER: invalid-provider');
  });
});

describe('organizeItinerary', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  it('returns parsed organized itinerary from LLM response', async () => {
    const fakeOrganized = [{ id: 'ii-1', day: 2, timeBlock: 'afternoon' }];
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fakeOrganized) } }],
    });

    const result = await organizeItinerary([
      {
        id: 'ii-1',
        day: 1,
        timeBlock: 'morning',
        activity: {
          title: 'Louvre',
          description: 'Museum',
          type: 'place',
          city: 'Paris',
          suggestedTime: 'morning',
          durationMinutes: 120,
        },
      },
    ]);

    expect(result).toEqual(fakeOrganized);
  });

  it('returns an empty array when organize response cannot be parsed', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not-json' } }],
    });

    const result = await organizeItinerary([]);
    expect(result).toEqual([]);
  });
});

describe('fillActivityDetails', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns parsed fill details from LLM response', async () => {
    const fakeFill = {
      description: 'A famous ski resort in Hokkaido, Japan.',
      type: 'place',
      suggestedTime: 'morning',
      durationMinutes: 180,
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fakeFill) } }],
    });

    const result = await fillActivityDetails('Tomamu Ski Resort', 'Hokkaido');
    expect(result).toEqual(fakeFill);
  });

  it('includes title and city in the LLM prompt', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });

    await fillActivityDetails('Tomamu Ski Resort', 'Hokkaido');

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt = callArgs.messages[0].content as string;
    expect(prompt).toContain('Tomamu Ski Resort');
    expect(prompt).toContain('Hokkaido');
  });

  it('extracts JSON object from response that contains extra text', async () => {
    const fakeFill = { description: 'Great ski resort', type: 'place', suggestedTime: 'morning', durationMinutes: 120 };
    const responseWithExtraText = `Here are the details:\n${JSON.stringify(fakeFill)}\nEnjoy!`;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: responseWithExtraText } }],
    });

    const result = await fillActivityDetails('Tomamu', 'Hokkaido');
    expect(result.description).toBe('Great ski resort');
    expect(result.type).toBe('place');
  });

  it('returns defaults when JSON parsing fails entirely', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not valid json at all' } }],
    });

    const result = await fillActivityDetails('Unknown', 'City');
    expect(result).toEqual({
      description: '',
      type: 'place',
      suggestedTime: 'afternoon',
      durationMinutes: null,
    });
  });

  it('defaults type to place when LLM returns unknown type', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: 'restaurant', suggestedTime: 'dinner', durationMinutes: 60, description: 'Nice' }) } }],
    });

    const result = await fillActivityDetails('Some Place', 'City');
    expect(result.type).toBe('place');
  });

  it('defaults suggestedTime to afternoon when LLM returns unknown value', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: 'food', suggestedTime: 'brunch', durationMinutes: 60, description: 'Nice' }) } }],
    });

    const result = await fillActivityDetails('Some Place', 'City');
    expect(result.suggestedTime).toBe('afternoon');
  });

  it('sets durationMinutes to null when LLM returns non-number', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: 'place', suggestedTime: 'afternoon', durationMinutes: 'about an hour', description: 'Nice' }) } }],
    });

    const result = await fillActivityDetails('Some Place', 'City');
    expect(result.durationMinutes).toBeNull();
  });

  it('accepts food as a valid type', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ type: 'food', suggestedTime: 'dinner', durationMinutes: 90, description: 'Great restaurant' }) } }],
    });

    const result = await fillActivityDetails('Le Bistro', 'Paris');
    expect(result.type).toBe('food');
  });
});

describe('generateChatActionPlan', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses activity-first action types in prompt contract', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ summary: '', actionPlan: [] }) } }],
    });

    await generateChatActionPlan('Add one spot', {
      tripId: 'trip-1',
      userId: 'user-1',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt = callArgs.messages[0].content as string;
    expect(prompt).toContain('"type": "activity.generate"');
    expect(prompt).toContain('"type": "activity.create"');
    expect(prompt).toContain('"type": "activity.update"');
    expect(prompt).toContain('"type": "activity.delete"');
    expect(prompt).toContain('"type": "itinerary.addActivity"');
    expect(prompt).toContain('"activityId": "activity-id"');
    expect(prompt).toContain('"activityType": "place"');
    expect(prompt).not.toContain('"type": "proposal.generate"');
    expect(prompt).not.toContain('"type": "proposal.create"');
    expect(prompt).not.toContain('"type": "itinerary.addProposal"');
  });
});

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

import { generateProposals } from '@/lib/llm';
import OpenAI from 'openai';

describe('generateProposals', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreate.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns parsed proposals from the LLM response', async () => {
    const fakeProposals = [
      {
        type: 'food',
        title: 'Le Bistro',
        description: 'Great food',
        reason: 'You like French',
        lat: 48.86,
        lng: 2.33,
        city: 'Paris',
        suggestedTime: 'dinner',
        durationMinutes: 90,
      },
    ];

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fakeProposals) } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual(fakeProposals);
  });

  it('extracts JSON array from response that contains extra text', async () => {
    const fakeProposals = [{ type: 'place', title: 'Louvre', description: 'Museum', reason: 'Art', lat: 48.86, lng: 2.33, city: 'Paris', suggestedTime: 'morning', durationMinutes: 120 }];
    const responseWithExtraText = `Here are some proposals:\n${JSON.stringify(fakeProposals)}\nEnjoy!`;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: responseWithExtraText } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual(fakeProposals);
  });

  it('returns an empty array when JSON parsing fails entirely', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'This is not JSON at all.' } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual([]);
  });

  it('returns an empty array when response content is null', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual([]);
  });

  it('includes existing proposal titles in the prompt context to avoid duplicates', async () => {
    const existingProposals = [{ title: 'Eiffel Tower' }];

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateProposals([], 'Paris', existingProposals);

    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain('Eiffel Tower');
  });

  it('passes preferences to the LLM prompt', async () => {
    const preferences = [{ likes: 'sushi', dislikes: 'spicy', budget: 'medium' }];
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateProposals(preferences, 'Tokyo');

    const callArgs = mockCreate.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain('sushi');
    expect(promptContent).toContain('Tokyo');
  });

  it('uses gpt-5-mini as the default OpenAI model when OPENAI_MODEL is not set', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    delete process.env.OPENAI_MODEL;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.BIFROST_API_KEY;

    await generateProposals([], 'Paris');
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

    await generateProposals([], 'Paris');

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

    await generateProposals([], 'Paris');

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

    await generateProposals([], 'Paris');

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

    await generateProposals([], 'Paris');

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

    await generateProposals([], 'Paris');

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

    await generateProposals([], 'Paris');

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

    await generateProposals([], 'Paris');

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

    await expect(generateProposals([], 'Paris')).rejects.toThrow('Bifrost authentication failed. Check BIFROST_API_KEY.');
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

    await generateProposals([], 'Paris');

    const openAIMock = OpenAI as unknown as jest.Mock;
    expect(openAIMock).toHaveBeenCalledWith({
      apiKey: 'openai-key',
    });
  });

  it('throws when LLM_PROVIDER is unsupported', async () => {
    process.env.LLM_PROVIDER = 'invalid-provider';
    await expect(generateProposals([], 'Paris')).rejects.toThrow('Unsupported LLM_PROVIDER: invalid-provider');
  });
});

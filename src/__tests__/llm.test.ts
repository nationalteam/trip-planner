jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

import { generateProposals } from '@/lib/llm';
import OpenAI from 'openai';

describe('generateProposals', () => {
  let create: jest.Mock;

  beforeAll(() => {
    // llm.ts creates `new OpenAI(...)` at module load time; capture its create fn
    const openAIMock = OpenAI as unknown as jest.Mock;
    const instance = openAIMock.mock.results[0].value as {
      chat: { completions: { create: jest.Mock } };
    };
    create = instance.chat.completions.create;
  });

  beforeEach(() => {
    create.mockReset();
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

    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fakeProposals) } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual(fakeProposals);
  });

  it('extracts JSON array from response that contains extra text', async () => {
    const fakeProposals = [{ type: 'place', title: 'Louvre', description: 'Museum', reason: 'Art', lat: 48.86, lng: 2.33, city: 'Paris', suggestedTime: 'morning', durationMinutes: 120 }];
    const responseWithExtraText = `Here are some proposals:\n${JSON.stringify(fakeProposals)}\nEnjoy!`;

    create.mockResolvedValue({
      choices: [{ message: { content: responseWithExtraText } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual(fakeProposals);
  });

  it('returns an empty array when JSON parsing fails entirely', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'This is not JSON at all.' } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual([]);
  });

  it('returns an empty array when response content is null', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await generateProposals([], 'Paris');
    expect(result).toEqual([]);
  });

  it('includes already-approved proposal titles in the prompt context', async () => {
    const existingApproved = [{ title: 'Eiffel Tower' }];

    create.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateProposals([], 'Paris', existingApproved);

    const callArgs = create.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain('Eiffel Tower');
  });

  it('passes preferences to the LLM prompt', async () => {
    const preferences = [{ likes: 'sushi', dislikes: 'spicy', budget: 'medium' }];
    create.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    await generateProposals(preferences, 'Tokyo');

    const callArgs = create.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain('sushi');
    expect(promptContent).toContain('Tokyo');
  });

  it('uses gpt-5-mini as the default OpenAI model when OPENAI_MODEL is not set', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    const originalModel = process.env.OPENAI_MODEL;
    const originalAzureKey = process.env.AZURE_OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.AZURE_OPENAI_API_KEY;

    try {
      await generateProposals([], 'Paris');
      const callArgs = create.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-5-mini');
    } finally {
      if (originalModel === undefined) {
        delete process.env.OPENAI_MODEL;
      } else {
        process.env.OPENAI_MODEL = originalModel;
      }
      if (originalAzureKey === undefined) {
        delete process.env.AZURE_OPENAI_API_KEY;
      } else {
        process.env.AZURE_OPENAI_API_KEY = originalAzureKey;
      }
    }
  });
});

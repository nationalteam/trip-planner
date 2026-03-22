import OpenAI, { AzureOpenAI } from 'openai';

type Provider = 'openai' | 'azure' | 'bifrost';

function normalizeAzureEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/openai(?:\/v\d+)?$/i, '');
}

function normalizeBifrostBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim();
  if (!trimmed) {
    throw new Error(
      'BIFROST_BASE_URL is set but empty or whitespace-only. Either unset it to use the default http://127.0.0.1:8080 or provide a valid absolute URL.',
    );
  }
  const normalized = trimmed.replace(/\/+$/, '');
  if (/\/openai\/v\d+$/i.test(normalized)) return normalized;
  if (/\/openai$/i.test(normalized)) return `${normalized}/v1`;
  if (/\/v\d+$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/openai/v1`;
}

function resolveProvider(): Provider {
  const configured = process.env.LLM_PROVIDER?.toLowerCase();
  if (configured === 'openai' || configured === 'azure' || configured === 'bifrost') {
    return configured;
  }
  if (configured) {
    throw new Error(`Unsupported LLM_PROVIDER: ${process.env.LLM_PROVIDER}`);
  }
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.AZURE_OPENAI_API_KEY) return 'azure';
  if (process.env.BIFROST_BASE_URL || process.env.BIFROST_API_KEY) return 'bifrost';
  return 'openai';
}

function assertAzureConfig(provider: Provider) {
  if (provider !== 'azure') return;

  if (!process.env.AZURE_OPENAI_API_KEY) {
    throw new Error('AZURE_OPENAI_API_KEY is required when LLM_PROVIDER is "azure".');
  }
  if (!process.env.AZURE_OPENAI_ENDPOINT) {
    throw new Error('Missing AZURE_OPENAI_ENDPOINT. Example: https://<resource>.openai.azure.com');
  }
}

function createClient(provider: Provider): OpenAI {
  if (provider === 'azure') {
    assertAzureConfig(provider);
    return new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: normalizeAzureEndpoint(process.env.AZURE_OPENAI_ENDPOINT!),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
  }
  if (provider === 'bifrost') {
    return new OpenAI({
      apiKey: process.env.BIFROST_API_KEY ?? '',
      baseURL: normalizeBifrostBaseURL(process.env.BIFROST_BASE_URL ?? 'http://127.0.0.1:8080'),
    });
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function mapProviderError(provider: Provider, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const maybeError = error as { status?: number } | null;
  const status = typeof maybeError?.status === 'number' ? maybeError.status : undefined;

  if (provider === 'bifrost') {
    if (status === 401 || status === 403) {
      throw new Error('Bifrost authentication failed. Check BIFROST_API_KEY.');
    }
    if (status === 404) {
      throw new Error('Bifrost endpoint not found. Check BIFROST_BASE_URL.');
    }
    if (status === 429) {
      throw new Error('Bifrost rate limit exceeded. Please retry later.');
    }
    if (status && status >= 500) {
      throw new Error('Bifrost API is currently unavailable. Please retry later.');
    }
    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('fetch failed')) {
      throw new Error('Cannot reach Bifrost endpoint. Check BIFROST_BASE_URL and network connectivity.');
    }
  }

  throw error instanceof Error ? error : new Error(message);
}

interface ProposalLike {
  title?: string;
}

export interface ItineraryItemForLLM {
  id: string;
  day: number;
  timeBlock: string;
  proposal: {
    title: string;
    description: string;
    type: string;
    city: string;
    suggestedTime: string;
    durationMinutes: number | null;
  };
}

export interface OrganizedItineraryItem {
  id: string;
  day: number;
  timeBlock: 'morning' | 'afternoon' | 'dinner';
}

export async function generateProposals(preferences: object[], city: string, existingProposals: ProposalLike[] = []) {
  const provider = resolveProvider();
  const openai = createClient(provider);
  const prompt = `You are a travel planner. Generate restaurant and place proposals for a trip.

City: ${city}
User Preferences: ${JSON.stringify(preferences, null, 2)}
${existingProposals.length > 0 ? `Already proposed (do not repeat these): ${JSON.stringify(existingProposals.map(p => p.title))}` : ''}

Return a JSON array of 5-8 proposals with this exact format:
[
  {
    "type": "food",
    "title": "Restaurant Name",
    "description": "Brief description",
    "reason": "Why this matches preferences",
    "city": "${city}",
    "suggestedTime": "dinner",
    "durationMinutes": 90
  }
]

Types can be "food" or "place".
suggestedTime can be "lunch", "dinner", "morning", "afternoon", or "night".
Return ONLY valid JSON, no markdown.`;

  const fallbackModel = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
  const model = provider === 'azure'
    ? (process.env.AZURE_OPENAI_DEPLOYMENT ?? fallbackModel)
    : provider === 'bifrost'
      ? fallbackModel
      : fallbackModel;

  let response;
  try {
    response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (error) {
    mapProviderError(provider, error);
  }

  const content = response.choices[0].message.content || '[]';
  try {
    return JSON.parse(content);
  } catch {
    try {
      const match = content.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }
}

export async function organizeItinerary(items: ItineraryItemForLLM[]): Promise<OrganizedItineraryItem[]> {
  const provider = resolveProvider();
  const openai = createClient(provider);
  const fallbackModel = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
  const model = provider === 'azure'
    ? (process.env.AZURE_OPENAI_DEPLOYMENT ?? fallbackModel)
    : fallbackModel;

  const prompt = `You are a travel planner assistant. Reorganize an itinerary to make each day flow naturally.

Input itinerary items:
${JSON.stringify(items, null, 2)}

Return a JSON array with the exact same ids, each appearing exactly once, in this format:
[
  {
    "id": "item-id",
    "day": 1,
    "timeBlock": "morning"
  }
]

Rules:
- day must be an integer >= 1
- timeBlock must be one of "morning", "afternoon", "dinner"
- return ONLY valid JSON (no markdown, no extra text).`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (error) {
    mapProviderError(provider, error);
  }

  const content = response.choices[0].message.content || '[]';
  try {
    return JSON.parse(content);
  } catch {
    try {
      const match = content.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }
}

import OpenAI, { AzureOpenAI } from 'openai';

function createClient(): OpenAI {
  if (process.env.AZURE_OPENAI_API_KEY) {
    return new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const openai = createClient();

interface ProposalLike {
  title?: string;
}

export async function generateProposals(preferences: object[], city: string, existingApproved: ProposalLike[] = []) {
  const prompt = `You are a travel planner. Generate restaurant and place proposals for a trip.

City: ${city}
User Preferences: ${JSON.stringify(preferences, null, 2)}
${existingApproved.length > 0 ? `Already approved: ${JSON.stringify(existingApproved.map(p => p.title))}` : ''}

Return a JSON array of 5-8 proposals with this exact format:
[
  {
    "type": "food",
    "title": "Restaurant Name",
    "description": "Brief description",
    "reason": "Why this matches preferences",
    "lat": 48.865,
    "lng": 2.321,
    "city": "${city}",
    "suggestedTime": "dinner",
    "durationMinutes": 90
  }
]

Types can be "food" or "place".
suggestedTime can be "lunch", "dinner", "morning", "afternoon", or "night".
Return ONLY valid JSON, no markdown.`;

  const model = process.env.AZURE_OPENAI_API_KEY
    ? (process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-5-mini')
    : (process.env.OPENAI_MODEL ?? 'gpt-5-mini');

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices[0].message.content || '[]';
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

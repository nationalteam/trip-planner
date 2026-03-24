import { prisma } from '@/lib/prisma';
import { fillProposalDetails, generateChatActionPlan, generateProposals, organizeItinerary, type ItineraryItemForLLM } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { ITINERARY_TIME_BLOCKS, isItineraryTimeBlock, normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';
import { getCoordinateCentroid, normalizeCoordinateBatch } from '@/lib/coordinates';
import { isValidDateOnly } from '@/lib/dates';

type ProposalType = 'food' | 'place' | 'hotel';
type SuggestedTime = 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'night';
type GeneratedProposal = {
  type?: string;
  title: string;
  description: string;
  reason?: string;
  city?: string;
  suggestedTime?: string;
  durationMinutes?: number | null;
};

export type ChatAction =
  | { type: 'proposal.generate'; city: string }
  | {
    type: 'proposal.create';
    title: string;
    description: string;
    city: string;
    proposalType?: ProposalType;
    suggestedTime?: SuggestedTime;
    durationMinutes?: number | null;
    lat?: number;
    lng?: number;
  }
  | {
    type: 'proposal.update';
    proposalId: string;
    title?: string;
    description?: string;
    city?: string;
    proposalType?: ProposalType;
    suggestedTime?: SuggestedTime;
    durationMinutes?: number | null;
    lat?: number;
    lng?: number;
  }
  | { type: 'proposal.delete'; proposalId: string }
  | { type: 'itinerary.organize' }
  | {
    type: 'itinerary.addProposal';
    proposalId: string;
    day?: number;
    timeBlock?: (typeof ITINERARY_TIME_BLOCKS)[number];
    order?: number;
  }
  | {
    type: 'trip.update';
    name?: string;
    cities?: string[];
    startDate?: string | null;
    durationDays?: number | null;
  }
  | {
    type: 'preference.updateMe';
    likes?: string[];
    dislikes?: string[];
    budget?: string | null;
    preferredLanguage?: string | null;
  };

const ALLOWED_ACTION_TYPES: ChatAction['type'][] = [
  'proposal.generate',
  'proposal.create',
  'proposal.update',
  'proposal.delete',
  'itinerary.organize',
  'itinerary.addProposal',
  'trip.update',
  'preference.updateMe',
];

const suggestedTimes: SuggestedTime[] = ['morning', 'lunch', 'afternoon', 'dinner', 'night'];

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}. Expected an object.`);
  }
  return value as Record<string, unknown>;
}

function assertAllowedKeys(obj: Record<string, unknown>, allowedKeys: string[]) {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Unsupported field "${key}"`);
    }
  }
}

function normalizeOptionalString(value: unknown, field: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') throw new Error(`Invalid ${field}. Expected string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Invalid ${field}. Expected non-empty string.`);
  return trimmed;
}

function normalizeOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected string array.`);
  const normalized = value.map((v) => {
    if (typeof v !== 'string') throw new Error(`Invalid ${field}. Expected string array.`);
    const trimmed = v.trim();
    if (!trimmed) throw new Error(`Invalid ${field}. Entries must be non-empty strings.`);
    return trimmed;
  });
  return normalized;
}

function normalizeOptionalInteger(value: unknown, field: string, min: number): number | undefined {
  if (value == null) return undefined;
  if (!Number.isInteger(value) || Number(value) < min) throw new Error(`Invalid ${field}.`);
  return Number(value);
}

function normalizeOptionalNumber(value: unknown, field: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${field}.`);
  return value;
}

function normalizeOptionalDuration(value: unknown): number | null | undefined {
  if (value == null || value === '') return null;
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error('Invalid durationMinutes.');
  return Number(value);
}

function normalizeOptionalSuggestedTime(value: unknown): SuggestedTime | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string' || !suggestedTimes.includes(value as SuggestedTime)) {
    throw new Error('Invalid suggestedTime.');
  }
  return value as SuggestedTime;
}

function normalizeOptionalProposalType(value: unknown): ProposalType | undefined {
  if (value == null) return undefined;
  if (value !== 'food' && value !== 'place' && value !== 'hotel') throw new Error('Invalid proposalType.');
  return value;
}

function normalizeTripStartDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !isValidDateOnly(value.trim())) {
    throw new Error('Invalid startDate. Expected YYYY-MM-DD.');
  }
  return value.trim();
}

function normalizeTripDurationDays(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value === '') return null;
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error('Invalid durationDays. Expected a positive integer.');
  return Number(value);
}

export function validateChatAction(value: unknown): ChatAction {
  const raw = asObject(value, 'action');
  const type = raw.type;
  if (typeof type !== 'string' || !ALLOWED_ACTION_TYPES.includes(type as ChatAction['type'])) {
    throw new Error('Unsupported action type.');
  }

  if (type === 'proposal.generate') {
    assertAllowedKeys(raw, ['type', 'city']);
    const city = normalizeOptionalString(raw.city, 'city');
    if (!city) throw new Error('Invalid city. Expected non-empty string.');
    return { type, city };
  }

  if (type === 'proposal.create') {
    assertAllowedKeys(raw, ['type', 'title', 'description', 'city', 'proposalType', 'suggestedTime', 'durationMinutes', 'lat', 'lng']);
    const title = normalizeOptionalString(raw.title, 'title');
    const description = normalizeOptionalString(raw.description, 'description');
    const city = normalizeOptionalString(raw.city, 'city');
    if (!title || !description || !city) {
      throw new Error('proposal.create requires title, description, and city.');
    }
    return {
      type,
      title,
      description,
      city,
      proposalType: normalizeOptionalProposalType(raw.proposalType),
      suggestedTime: normalizeOptionalSuggestedTime(raw.suggestedTime),
      durationMinutes: normalizeOptionalDuration(raw.durationMinutes),
      lat: normalizeOptionalNumber(raw.lat, 'lat'),
      lng: normalizeOptionalNumber(raw.lng, 'lng'),
    };
  }

  if (type === 'proposal.update') {
    assertAllowedKeys(raw, ['type', 'proposalId', 'title', 'description', 'city', 'proposalType', 'suggestedTime', 'durationMinutes', 'lat', 'lng']);
    const proposalId = normalizeOptionalString(raw.proposalId, 'proposalId');
    if (!proposalId) throw new Error('proposal.update requires proposalId.');
    return {
      type,
      proposalId,
      title: normalizeOptionalString(raw.title, 'title'),
      description: normalizeOptionalString(raw.description, 'description'),
      city: normalizeOptionalString(raw.city, 'city'),
      proposalType: normalizeOptionalProposalType(raw.proposalType),
      suggestedTime: normalizeOptionalSuggestedTime(raw.suggestedTime),
      durationMinutes: normalizeOptionalDuration(raw.durationMinutes),
      lat: normalizeOptionalNumber(raw.lat, 'lat'),
      lng: normalizeOptionalNumber(raw.lng, 'lng'),
    };
  }

  if (type === 'proposal.delete') {
    assertAllowedKeys(raw, ['type', 'proposalId']);
    const proposalId = normalizeOptionalString(raw.proposalId, 'proposalId');
    if (!proposalId) throw new Error('proposal.delete requires proposalId.');
    return { type, proposalId };
  }

  if (type === 'itinerary.organize') {
    assertAllowedKeys(raw, ['type']);
    return { type };
  }

  if (type === 'itinerary.addProposal') {
    assertAllowedKeys(raw, ['type', 'proposalId', 'day', 'timeBlock', 'order']);
    const proposalId = normalizeOptionalString(raw.proposalId, 'proposalId');
    if (!proposalId) throw new Error('itinerary.addProposal requires proposalId.');
    const day = normalizeOptionalInteger(raw.day, 'day', 1);
    const order = normalizeOptionalInteger(raw.order, 'order', 0);
    const timeBlock = raw.timeBlock == null
      ? undefined
      : (typeof raw.timeBlock === 'string' && isItineraryTimeBlock(raw.timeBlock)
        ? raw.timeBlock
        : (() => {
          throw new Error('Invalid timeBlock.');
        })());
    return { type, proposalId, day, timeBlock, order };
  }

  if (type === 'trip.update') {
    assertAllowedKeys(raw, ['type', 'name', 'cities', 'startDate', 'durationDays']);
    return {
      type,
      name: normalizeOptionalString(raw.name, 'name'),
      cities: normalizeOptionalStringArray(raw.cities, 'cities'),
      startDate: normalizeTripStartDate(raw.startDate),
      durationDays: normalizeTripDurationDays(raw.durationDays),
    };
  }

  const preferenceType: Extract<ChatAction, { type: 'preference.updateMe' }>['type'] = 'preference.updateMe';
  assertAllowedKeys(raw, ['type', 'likes', 'dislikes', 'budget', 'preferredLanguage']);
  return {
    type: preferenceType,
    likes: normalizeOptionalStringArray(raw.likes, 'likes'),
    dislikes: normalizeOptionalStringArray(raw.dislikes, 'dislikes'),
    budget: raw.budget == null ? null : normalizeOptionalString(raw.budget, 'budget') ?? null,
    preferredLanguage: raw.preferredLanguage == null ? null : normalizeOptionalString(raw.preferredLanguage, 'preferredLanguage') ?? null,
  };
}

export function validateChatActionPlan(value: unknown): ChatAction[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid actionPlan. Expected an array.');
  }
  return value.map(validateChatAction);
}

export async function planTripActions(
  message: string,
  context: { tripId: string; userId: string; extraContext?: unknown }
): Promise<{ summary: string; actionPlan: ChatAction[] }> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('message is required');
  }

  const llmResult = await generateChatActionPlan(trimmed, context).catch((error) => {
    console.error(`Failed to generate chat action plan for trip ${context.tripId}`, error);
    return { summary: '', actionPlan: [] as unknown[] };
  });
  const actionPlan = validateChatActionPlan(llmResult.actionPlan ?? []);
  const summary = typeof llmResult.summary === 'string' && llmResult.summary.trim()
    ? llmResult.summary.trim()
    : (actionPlan.length > 0 ? `Planned ${actionPlan.length} action(s).` : 'No executable actions identified.');
  return { summary, actionPlan };
}

async function createProposalFromAction(tripId: string, action: Extract<ChatAction, { type: 'proposal.create' }>) {
  const hasManualCoordinates = Number.isFinite(action.lat) && Number.isFinite(action.lng);
  const resolvedCoordinates = hasManualCoordinates
    ? { lat: action.lat!, lng: action.lng! }
    : await geocodeWithGoogleMaps(`${action.title}, ${action.city}`);
  if (!resolvedCoordinates) {
    throw new Error(`Unable to resolve coordinates for proposal "${action.title}".`);
  }
  const normalized = normalizeCoordinateBatch([resolvedCoordinates])[0];
  return prisma.proposal.create({
    data: {
      tripId,
      type: action.proposalType ?? 'place',
      title: action.title,
      description: action.description,
      reason: '',
      lat: normalized.lat,
      lng: normalized.lng,
      city: action.city,
      suggestedTime: action.suggestedTime ?? 'afternoon',
      durationMinutes: action.durationMinutes ?? null,
      status: 'pending',
    },
  });
}

export async function executeTripActions(tripId: string, userId: string, actionPlan: ChatAction[]) {
  const validated = validateChatActionPlan(actionPlan);
  const results: Array<{ type: ChatAction['type']; status: 'success'; detail?: string }> = [];

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error('Trip not found');

  for (const action of validated) {
    if (action.type === 'proposal.generate') {
      const members = await prisma.tripMember.findMany({
        where: { tripId },
        select: { userId: true },
      });
      const allPreferences = await prisma.preference.findMany({
        where: { userId: { in: members.map((member) => member.userId) } },
      });
      const existingProposals = await prisma.proposal.findMany({ where: { tripId } });
      const existingCenter = getCoordinateCentroid(existingProposals.filter((proposal) => proposal.city === action.city));
      const generated = await generateProposals(allPreferences, action.city, existingProposals) as GeneratedProposal[];
      const withCoordinates = await Promise.all(generated.map(async (proposal: GeneratedProposal) => {
        const geocoded = await geocodeWithGoogleMaps(`${proposal.title}, ${proposal.city || action.city}`);
        return geocoded ? { ...proposal, ...geocoded } : null;
      }));
      const normalizedGenerated = normalizeCoordinateBatch(
        withCoordinates.filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null),
        { reference: existingCenter ?? undefined }
      );
      if (normalizedGenerated.length > 0) {
        await prisma.$transaction(
          normalizedGenerated.map((p) =>
            prisma.proposal.create({
              data: {
                tripId,
                type: normalizeOptionalProposalType(p.type) ?? 'place',
                title: p.title,
                description: p.description,
                reason: p.reason || '',
                lat: p.lat,
                lng: p.lng,
                city: p.city || action.city,
                suggestedTime: normalizeOptionalSuggestedTime(p.suggestedTime) ?? 'afternoon',
                durationMinutes: p.durationMinutes || null,
                status: 'pending',
              },
            })
          )
        );
      }
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'proposal.create') {
      await createProposalFromAction(tripId, action);
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'proposal.update') {
      const existing = await prisma.proposal.findUnique({ where: { id: action.proposalId } });
      if (!existing || existing.tripId !== tripId) throw new Error('Proposal not found');

      let normalizedLatLng:
        | { lat: number; lng: number }
        | undefined;
      if (action.lat != null || action.lng != null) {
        if (action.lat == null || action.lng == null) {
          throw new Error('Both lat and lng are required when setting coordinates.');
        }
        normalizedLatLng = normalizeCoordinateBatch([{ lat: action.lat, lng: action.lng }])[0];
      }

      await prisma.proposal.update({
        where: { id: action.proposalId },
        data: {
          type: action.proposalType,
          title: action.title,
          description: action.description,
          city: action.city,
          suggestedTime: action.suggestedTime,
          durationMinutes: action.durationMinutes,
          lat: normalizedLatLng?.lat,
          lng: normalizedLatLng?.lng,
        },
      });
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'proposal.delete') {
      const existing = await prisma.proposal.findUnique({ where: { id: action.proposalId } });
      if (!existing || existing.tripId !== tripId) throw new Error('Proposal not found');
      await prisma.itineraryItem.deleteMany({ where: { proposalId: action.proposalId } });
      await prisma.proposal.delete({ where: { id: action.proposalId } });
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'itinerary.organize') {
      const items = await prisma.itineraryItem.findMany({
        where: { tripId },
        include: { proposal: true },
        orderBy: [{ day: 'asc' }],
      });
      if (items.length > 0) {
        const organized = await organizeItinerary(items as ItineraryItemForLLM[]);
        const itemIds = new Set(items.map((item) => item.id));
        const normalized = organized.filter(
          (item) =>
            typeof item?.id === 'string' &&
            itemIds.has(item.id) &&
            Number.isInteger(item.day) &&
            item.day >= 1 &&
            isItineraryTimeBlock(item.timeBlock)
        );
        if (normalized.length !== items.length) {
          throw new Error('LLM returned incomplete or invalid itinerary mapping');
        }
        await prisma.$transaction(
          normalized.map((item, index) =>
            prisma.itineraryItem.update({
              where: { id: item.id },
              data: { day: item.day, timeBlock: item.timeBlock, order: index },
            })
          )
        );
      }
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'itinerary.addProposal') {
      const proposal = await prisma.proposal.findUnique({ where: { id: action.proposalId } });
      if (!proposal || proposal.tripId !== tripId) throw new Error('Proposal not found');
      const existingItem = await prisma.itineraryItem.findUnique({ where: { proposalId: action.proposalId } });
      const day = action.day ?? (existingItem?.day ?? 1);
      const timeBlock = action.timeBlock ?? (existingItem?.timeBlock && isItineraryTimeBlock(existingItem.timeBlock)
        ? existingItem.timeBlock
        : normalizeSuggestedTimeToTimeBlock(proposal.suggestedTime));
      const order = action.order ?? (existingItem?.order ?? 0);
      if (existingItem) {
        await prisma.itineraryItem.update({
          where: { id: existingItem.id },
          data: { day, timeBlock, order },
        });
      } else {
        await prisma.itineraryItem.create({
          data: {
            tripId,
            proposalId: action.proposalId,
            day,
            timeBlock,
            order,
          },
        });
      }
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'trip.update') {
      const data: {
        name?: string;
        cities?: string;
        startDate?: string | null;
        durationDays?: number | null;
      } = {};
      if (action.name !== undefined) data.name = action.name;
      if (action.cities !== undefined) data.cities = JSON.stringify(action.cities);
      if (action.startDate !== undefined) data.startDate = action.startDate;
      if (action.durationDays !== undefined) data.durationDays = action.durationDays;
      await prisma.trip.update({ where: { id: tripId }, data });
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'preference.updateMe') {
      const existing = await prisma.preference.findFirst({ where: { userId } });
      const payload = {
        likes: JSON.stringify(action.likes ?? []),
        dislikes: JSON.stringify(action.dislikes ?? []),
        budget: action.budget ?? null,
        preferredLanguage: action.preferredLanguage ?? null,
      };
      if (existing) {
        await prisma.preference.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await prisma.preference.create({
          data: {
            userId,
            ...payload,
          },
        });
      }
      results.push({ type: action.type, status: 'success' });
      continue;
    }
  }

  const [updatedTrip, proposals, itinerary] = await Promise.all([
    prisma.trip.findUnique({ where: { id: tripId } }),
    prisma.proposal.findMany({ where: { tripId }, orderBy: { createdAt: 'desc' } }),
    prisma.itineraryItem.findMany({
      where: { tripId },
      include: { proposal: true },
      orderBy: [{ day: 'asc' }, { timeBlock: 'asc' }, { order: 'asc' }],
    }),
  ]);

  return {
    results,
    trip: updatedTrip,
    proposals,
    itinerary,
  };
}

export async function suggestProposalCreateActionFromTitle(title: string, city: string): Promise<ChatAction> {
  const details = await fillProposalDetails(title, city);
  return {
    type: 'proposal.create',
    title,
    city,
    description: details.description || `${title} in ${city}`,
    proposalType: details.type,
    suggestedTime: details.suggestedTime,
    durationMinutes: details.durationMinutes,
  };
}

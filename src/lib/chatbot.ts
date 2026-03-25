import { prisma } from '@/lib/prisma';
import { fillActivityDetails, generateActivities, generateChatActionPlan, organizeItinerary, type ItineraryItemForLLM } from '@/lib/llm';
import { geocodeWithGoogleMaps } from '@/lib/geocoding';
import { ITINERARY_TIME_BLOCKS, isItineraryTimeBlock, normalizeSuggestedTimeToTimeBlock } from '@/lib/time-block';
import { getCoordinateCentroid, normalizeCoordinateBatch } from '@/lib/coordinates';
import { isValidDateOnly } from '@/lib/dates';

type ActivityType = 'food' | 'place' | 'hotel';
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
  | { type: 'activity.generate'; city: string }
  | {
    type: 'activity.create';
    title: string;
    description: string;
    city: string;
    activityType?: ActivityType;
    suggestedTime?: SuggestedTime;
    durationMinutes?: number | null;
    lat?: number;
    lng?: number;
  }
  | {
    type: 'activity.update';
    activityId: string;
    title?: string;
    description?: string;
    city?: string;
    activityType?: ActivityType;
    suggestedTime?: SuggestedTime;
    durationMinutes?: number | null;
    lat?: number;
    lng?: number;
  }
  | { type: 'activity.delete'; activityId: string }
  | { type: 'itinerary.organize' }
  | {
    type: 'itinerary.addActivity';
    activityId: string;
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
  'activity.generate',
  'activity.create',
  'activity.update',
  'activity.delete',
  'itinerary.organize',
  'itinerary.addActivity',
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

function normalizeOptionalActivityType(value: unknown): ActivityType | undefined {
  if (value == null) return undefined;
  if (value !== 'food' && value !== 'place' && value !== 'hotel') throw new Error('Invalid activityType.');
  return value;
}

function normalizeActionType(value: unknown): ChatAction['type'] {
  if (typeof value !== 'string') throw new Error('Unsupported action type.');

  if (value === 'proposal.generate') return 'activity.generate';
  if (value === 'proposal.create') return 'activity.create';
  if (value === 'proposal.update') return 'activity.update';
  if (value === 'proposal.delete') return 'activity.delete';
  if (value === 'itinerary.addProposal') return 'itinerary.addActivity';

  if (!ALLOWED_ACTION_TYPES.includes(value as ChatAction['type'])) {
    throw new Error('Unsupported action type.');
  }
  return value as ChatAction['type'];
}

function readActionId(raw: Record<string, unknown>, actionName: string): string {
  const activityId = normalizeOptionalString(raw.activityId, 'activityId');
  const proposalId = normalizeOptionalString(raw.proposalId, 'proposalId');
  const resolved = activityId ?? proposalId;
  if (!resolved) throw new Error(`${actionName} requires activityId.`);
  return resolved;
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
  const type = normalizeActionType(raw.type);

  if (type === 'activity.generate') {
    assertAllowedKeys(raw, ['type', 'city']);
    const city = normalizeOptionalString(raw.city, 'city');
    if (!city) throw new Error('Invalid city. Expected non-empty string.');
    return { type, city };
  }

  if (type === 'activity.create') {
    assertAllowedKeys(raw, ['type', 'title', 'description', 'city', 'activityType', 'proposalType', 'suggestedTime', 'durationMinutes', 'lat', 'lng']);
    const title = normalizeOptionalString(raw.title, 'title');
    const description = normalizeOptionalString(raw.description, 'description');
    const city = normalizeOptionalString(raw.city, 'city');
    if (!title || !description || !city) {
      throw new Error('activity.create requires title, description, and city.');
    }
    const activityType = normalizeOptionalActivityType(raw.activityType ?? raw.proposalType);
    return {
      type,
      title,
      description,
      city,
      activityType,
      suggestedTime: normalizeOptionalSuggestedTime(raw.suggestedTime),
      durationMinutes: normalizeOptionalDuration(raw.durationMinutes),
      lat: normalizeOptionalNumber(raw.lat, 'lat'),
      lng: normalizeOptionalNumber(raw.lng, 'lng'),
    };
  }

  if (type === 'activity.update') {
    assertAllowedKeys(raw, ['type', 'activityId', 'proposalId', 'title', 'description', 'city', 'activityType', 'proposalType', 'suggestedTime', 'durationMinutes', 'lat', 'lng']);
    const activityId = readActionId(raw, 'activity.update');
    const activityType = normalizeOptionalActivityType(raw.activityType ?? raw.proposalType);
    return {
      type,
      activityId,
      title: normalizeOptionalString(raw.title, 'title'),
      description: normalizeOptionalString(raw.description, 'description'),
      city: normalizeOptionalString(raw.city, 'city'),
      activityType,
      suggestedTime: normalizeOptionalSuggestedTime(raw.suggestedTime),
      durationMinutes: normalizeOptionalDuration(raw.durationMinutes),
      lat: normalizeOptionalNumber(raw.lat, 'lat'),
      lng: normalizeOptionalNumber(raw.lng, 'lng'),
    };
  }

  if (type === 'activity.delete') {
    assertAllowedKeys(raw, ['type', 'activityId', 'proposalId']);
    const activityId = readActionId(raw, 'activity.delete');
    return { type, activityId };
  }

  if (type === 'itinerary.organize') {
    assertAllowedKeys(raw, ['type']);
    return { type };
  }

  if (type === 'itinerary.addActivity') {
    assertAllowedKeys(raw, ['type', 'activityId', 'proposalId', 'day', 'timeBlock', 'order']);
    const activityId = readActionId(raw, 'itinerary.addActivity');
    const day = normalizeOptionalInteger(raw.day, 'day', 1);
    const order = normalizeOptionalInteger(raw.order, 'order', 0);
    const timeBlock = raw.timeBlock == null
      ? undefined
      : (typeof raw.timeBlock === 'string' && isItineraryTimeBlock(raw.timeBlock)
        ? raw.timeBlock
        : (() => {
          throw new Error('Invalid timeBlock.');
        })());
    return { type, activityId, day, timeBlock, order };
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

async function createActivityFromAction(tripId: string, action: Extract<ChatAction, { type: 'activity.create' }>) {
  const hasManualCoordinates = Number.isFinite(action.lat) && Number.isFinite(action.lng);
  const resolvedCoordinates = hasManualCoordinates
    ? { lat: action.lat!, lng: action.lng! }
    : await geocodeWithGoogleMaps(`${action.title}, ${action.city}`);
  if (!resolvedCoordinates) {
    throw new Error(`Unable to resolve coordinates for activity "${action.title}".`);
  }
  const normalized = normalizeCoordinateBatch([resolvedCoordinates])[0];
  return prisma.proposal.create({
    data: {
      tripId,
      type: action.activityType ?? 'place',
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
    if (action.type === 'activity.generate') {
      const members = await prisma.tripMember.findMany({
        where: { tripId },
        select: { userId: true },
      });
      const allPreferences = await prisma.preference.findMany({
        where: { userId: { in: members.map((member) => member.userId) } },
      });
      const existingProposals = await prisma.proposal.findMany({ where: { tripId } });
      const existingCenter = getCoordinateCentroid(existingProposals.filter((proposal) => proposal.city === action.city));
      const generated = await generateActivities(allPreferences, action.city, existingProposals) as GeneratedProposal[];
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
                type: normalizeOptionalActivityType(p.type) ?? 'place',
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

    if (action.type === 'activity.create') {
      await createActivityFromAction(tripId, action);
      results.push({ type: action.type, status: 'success' });
      continue;
    }

    if (action.type === 'activity.update') {
      const existing = await prisma.proposal.findUnique({ where: { id: action.activityId } });
      if (!existing || existing.tripId !== tripId) throw new Error('Activity not found');

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
        where: { id: action.activityId },
        data: {
          type: action.activityType,
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

    if (action.type === 'activity.delete') {
      const existing = await prisma.proposal.findUnique({ where: { id: action.activityId } });
      if (!existing || existing.tripId !== tripId) throw new Error('Activity not found');
      await prisma.itineraryItem.deleteMany({ where: { proposalId: action.activityId } });
      await prisma.proposal.delete({ where: { id: action.activityId } });
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

    if (action.type === 'itinerary.addActivity') {
      const proposal = await prisma.proposal.findUnique({ where: { id: action.activityId } });
      if (!proposal || proposal.tripId !== tripId) throw new Error('Activity not found');
      const existingItem = await prisma.itineraryItem.findUnique({ where: { proposalId: action.activityId } });
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
            proposalId: action.activityId,
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
    activities: proposals,
    itinerary,
  };
}

export async function suggestActivityCreateActionFromTitle(title: string, city: string): Promise<ChatAction> {
  const details = await fillActivityDetails(title, city);
  return {
    type: 'activity.create',
    title,
    city,
    description: details.description || `${title} in ${city}`,
    activityType: details.type,
    suggestedTime: details.suggestedTime,
    durationMinutes: details.durationMinutes,
  };
}

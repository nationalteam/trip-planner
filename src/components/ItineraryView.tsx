'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ITINERARY_TIME_BLOCK_LABELS,
  ITINERARY_TIME_BLOCKS,
  type ItineraryTimeBlock,
} from '@/lib/time-block';
import { calculateAutoScrollDelta } from '@/lib/drag-autoscroll';

interface ItineraryItem {
  id: string;
  day: number;
  timeBlock: string;
  order: number;
  activity: {
    id: string;
    title: string;
    description: string;
    type: string;
    city: string;
    durationMinutes: number | null;
    suggestedTime: string;
  };
}

interface ReorderPayload {
  id: string;
  day: number;
  timeBlock: string;
  order: number;
}

interface ItinerarySchedule {
  startDate?: string | null;
  durationDays?: number | null;
  itineraryVisibleDays?: number | null;
}

const typeIcons: Record<string, string> = {
  food: '🍽️',
  place: '🏛️',
  hotel: '🏨',
};

interface Props {
  items: ItineraryItem[];
  schedule?: ItinerarySchedule;
  onReorder?: (updates: ReorderPayload[]) => void;
  onDeleteEmptyDay?: (day: number) => void;
  deletingDay?: number | null;
}

function deriveDateLabel(startDate: string, day: number): string | null {
  const matched = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const dayOfMonth = Number(matched[3]);
  const base = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (Number.isNaN(base.getTime())) return null;

  const shifted = new Date(base);
  shifted.setUTCDate(base.getUTCDate() + (day - 1));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const weekday = shifted.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${y}-${m}-${d} (${weekday})`;
}

function buildDayHeading(day: number, schedule?: ItinerarySchedule): string {
  const hasDuration = typeof schedule?.durationDays === 'number' && schedule.durationDays > 0;
  const hasStartDate = typeof schedule?.startDate === 'string' && schedule.startDate.trim().length > 0;

  if (hasStartDate) {
    const derivedDate = deriveDateLabel(schedule.startDate!, day);
    if (derivedDate) {
      if (hasDuration) {
        return `Day ${day} / ${schedule.durationDays} days · ${derivedDate}`;
      }
      return `Day ${day} · ${derivedDate}`;
    }
  }

  if (hasDuration) {
    return `Day ${day} / ${schedule.durationDays} days`;
  }

  return `Day ${day}`;
}

export default function ItineraryView({ items, schedule, onReorder, onDeleteEmptyDay, deletingDay }: Props) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);
  const lastDragClientY = useRef<number | null>(null);
  const autoScrollFrameId = useRef<number | null>(null);
  const autoScrollActive = useRef(false);

  useEffect(() => () => {
    autoScrollActive.current = false;
    lastDragClientY.current = null;
    if (autoScrollFrameId.current != null) {
      window.cancelAnimationFrame(autoScrollFrameId.current);
      autoScrollFrameId.current = null;
    }
  }, []);

  const maxItemDay = items.reduce((max, item) => Math.max(max, item.day), 0);
  const plannedDays = typeof schedule?.durationDays === 'number' && schedule.durationDays > 0
    ? schedule.durationDays
    : null;
  const manualVisibleDays = typeof schedule?.itineraryVisibleDays === 'number' && schedule.itineraryVisibleDays > 0
    ? schedule.itineraryVisibleDays
    : 0;
  const visibleDays = plannedDays != null
    ? Math.max(plannedDays, maxItemDay)
    : Math.max(manualVisibleDays, maxItemDay);

  if (visibleDays <= 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📋</div>
        <p className="text-gray-500 text-lg">No itinerary items yet</p>
        <p className="text-gray-400 text-sm mt-1">Approve activities to build your itinerary</p>
      </div>
    );
  }

  const byDay = items.reduce((acc, item) => {
    if (!acc[item.day]) acc[item.day] = {};
    if (!acc[item.day][item.timeBlock]) acc[item.day][item.timeBlock] = [];
    acc[item.day][item.timeBlock].push(item);
    return acc;
  }, {} as Record<number, Record<string, ItineraryItem[]>>);

  const days = Array.from({ length: visibleDays }, (_, idx) => idx + 1);

  function stopAutoScrollLoop() {
    autoScrollActive.current = false;
    lastDragClientY.current = null;
    if (autoScrollFrameId.current != null) {
      window.cancelAnimationFrame(autoScrollFrameId.current);
      autoScrollFrameId.current = null;
    }
  }

  function runAutoScrollFrame() {
    if (!autoScrollActive.current) {
      autoScrollFrameId.current = null;
      return;
    }

    const clientY = lastDragClientY.current;
    if (clientY != null) {
      const delta = calculateAutoScrollDelta(clientY, window.innerHeight);
      if (delta !== 0) {
        window.scrollBy(0, delta);
      }
    }

    autoScrollFrameId.current = window.requestAnimationFrame(runAutoScrollFrame);
  }

  function startAutoScrollLoop() {
    if (autoScrollActive.current) return;
    autoScrollActive.current = true;
    if (autoScrollFrameId.current == null) {
      autoScrollFrameId.current = window.requestAnimationFrame(runAutoScrollFrame);
    }
  }

  function handleDragStart(e: React.DragEvent, itemId: string) {
    dragItemId.current = itemId;
    lastDragClientY.current = e.clientY;
    e.dataTransfer.effectAllowed = 'move';
    startAutoScrollLoop();
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== dragItemId.current) {
      setDragOverId(targetId);
    }
    lastDragClientY.current = e.clientY;
  }

  function handleDrop(
    e: React.DragEvent,
    targetId: string,
    dropTarget?: { day: number; timeBlock: string }
  ) {
    e.preventDefault();
    stopAutoScrollLoop();
    setDragOverId(null);
    const sourceId = dragItemId.current;
    dragItemId.current = null;

    if (!sourceId || sourceId === targetId) return;

    const sourceItem = items.find(i => i.id === sourceId);
    if (!sourceItem) return;

    const targetItem = items.find(i => i.id === targetId);
    const targetDay = dropTarget?.day ?? targetItem?.day;
    const targetTimeBlock = dropTarget?.timeBlock ?? targetItem?.timeBlock;
    if (!targetDay || !targetTimeBlock) return;

    // Move sourceItem to just after targetItem, adopting its day/timeBlock
    const withoutSource = items.filter(i => i.id !== sourceId);
    let targetIndex: number;
    if (targetItem) {
      targetIndex = withoutSource.findIndex(i => i.id === targetId);
    } else {
      targetIndex = -1;
      for (let i = withoutSource.length - 1; i >= 0; i--) {
        if (withoutSource[i].day === targetDay && withoutSource[i].timeBlock === targetTimeBlock) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) {
        targetIndex = withoutSource.length - 1;
      }
    }
    const reordered = [
      ...withoutSource.slice(0, targetIndex + 1),
      sourceItem,
      ...withoutSource.slice(targetIndex + 1),
    ];

    // Build the payload with new day, timeBlock, and per-group sequential order
    // Group items by their new day+timeBlock to assign sequential order within each group
    const groupCounters = new Map<string, number>();
    const updates: ReorderPayload[] = reordered.map(item => {
      const newDay = item.id === sourceId ? targetDay : item.day;
      const newTimeBlock = item.id === sourceId ? targetTimeBlock : item.timeBlock;
      const groupKey = `${newDay}:${newTimeBlock}`;
      const groupOrder = groupCounters.get(groupKey) ?? 0;
      groupCounters.set(groupKey, groupOrder + 1);
      return { id: item.id, day: newDay, timeBlock: newTimeBlock, order: groupOrder };
    });

    onReorder?.(updates);
  }

  function handleDragEnd() {
    stopAutoScrollLoop();
    dragItemId.current = null;
    setDragOverId(null);
  }

  return (
    <div className="space-y-8">
      {days.map(day => (
        <div key={day} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{buildDayHeading(day, schedule)}</h3>
              {typeof schedule?.durationDays === 'number' && schedule.durationDays > 0 && day > schedule.durationDays && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  Over planned range
                </span>
              )}
            </div>
          </div>
          <div className="p-6 space-y-6">
            {ITINERARY_TIME_BLOCKS.map((timeBlock: ItineraryTimeBlock) => {
              const slotId = `timeblock-dropzone-${day}-${timeBlock}`;
              const slotItems = byDay[day]?.[timeBlock] ?? [];
              return (
                <div key={timeBlock}>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {ITINERARY_TIME_BLOCK_LABELS[timeBlock]}
                </h4>
                <div
                  data-testid={slotId}
                  onDragOver={e => handleDragOver(e, slotId)}
                  onDrop={e => handleDrop(e, slotId, { day, timeBlock })}
                  className={`rounded-lg border border-dashed p-3 transition-colors ${
                    dragOverId === slotId
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="space-y-3">
                    {slotItems.length === 0 && (
                      <p className="text-xs text-gray-400">Drop activity here</p>
                    )}
                    {slotItems.map(item => (
                      (() => {
                        return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={e => handleDragStart(e, item.id)}
                        onDragOver={e => handleDragOver(e, item.id)}
                        onDrop={e => handleDrop(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
                          dragOverId === item.id
                            ? 'bg-blue-50 border-2 border-blue-300'
                            : 'bg-white'
                        }`}
                      >
                        <span className="text-xl mt-0.5 select-none">⠿</span>
                        <span className="text-xl mt-0.5">{typeIcons[item.activity.type] || '📌'}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.activity.title}</p>
                          <p className="text-sm text-gray-600">{item.activity.description}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-xs text-gray-400">{item.activity.city}</span>
                            {item.activity.durationMinutes && (
                              <span className="text-xs text-gray-400">⏱ {item.activity.durationMinutes}min</span>
                            )}
                          </div>
                        </div>
                      </div>
                        );
                      })()
                    ))}
                  </div>
                </div>
              </div>
              );
            })}
            {ITINERARY_TIME_BLOCKS.every(tb => !byDay[day]?.[tb]?.length) && (
              <div>
                <p className="text-sm text-gray-500">No items planned for this day yet</p>
                {onDeleteEmptyDay && (
                  <button
                    type="button"
                    onClick={() => onDeleteEmptyDay(day)}
                    disabled={deletingDay === day}
                    className="mt-3 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingDay === day ? 'Deleting...' : 'Delete day'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

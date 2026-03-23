'use client';

import { useState, useRef } from 'react';

interface ItineraryItem {
  id: string;
  day: number;
  timeBlock: string;
  order: number;
  proposal: {
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

const timeBlockOrder = ['morning', 'afternoon', 'dinner'];
const timeBlockLabels: Record<string, string> = {
  morning: '🌅 Morning',
  afternoon: '🌤 Afternoon',
  dinner: '🌙 Evening / Dinner',
};

const typeIcons: Record<string, string> = {
  food: '🍽️',
  place: '🏛️',
  hotel: '🏨',
};

interface Props {
  items: ItineraryItem[];
  onReorder?: (updates: ReorderPayload[]) => void;
}

export default function ItineraryView({ items, onReorder }: Props) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📋</div>
        <p className="text-gray-500 text-lg">No itinerary items yet</p>
        <p className="text-gray-400 text-sm mt-1">Approve proposals to build your itinerary</p>
      </div>
    );
  }

  const byDay = items.reduce((acc, item) => {
    if (!acc[item.day]) acc[item.day] = {};
    if (!acc[item.day][item.timeBlock]) acc[item.day][item.timeBlock] = [];
    acc[item.day][item.timeBlock].push(item);
    return acc;
  }, {} as Record<number, Record<string, ItineraryItem[]>>);

  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  function handleDragStart(e: React.DragEvent, itemId: string) {
    dragItemId.current = itemId;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== dragItemId.current) {
      setDragOverId(targetId);
    }
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = dragItemId.current;
    dragItemId.current = null;

    if (!sourceId || sourceId === targetId) return;

    const sourceItem = items.find(i => i.id === sourceId);
    const targetItem = items.find(i => i.id === targetId);
    if (!sourceItem || !targetItem) return;

    // Move sourceItem to just after targetItem, adopting its day/timeBlock
    const withoutSource = items.filter(i => i.id !== sourceId);
    const targetIndex = withoutSource.findIndex(i => i.id === targetId);
    const reordered = [
      ...withoutSource.slice(0, targetIndex + 1),
      sourceItem,
      ...withoutSource.slice(targetIndex + 1),
    ];

    // Build the payload with new day, timeBlock, and per-group sequential order
    // Group items by their new day+timeBlock to assign sequential order within each group
    const groupCounters = new Map<string, number>();
    const updates: ReorderPayload[] = reordered.map(item => {
      const newDay = item.id === sourceId ? targetItem.day : item.day;
      const newTimeBlock = item.id === sourceId ? targetItem.timeBlock : item.timeBlock;
      const groupKey = `${newDay}:${newTimeBlock}`;
      const groupOrder = groupCounters.get(groupKey) ?? 0;
      groupCounters.set(groupKey, groupOrder + 1);
      return { id: item.id, day: newDay, timeBlock: newTimeBlock, order: groupOrder };
    });

    onReorder?.(updates);
  }

  function handleDragEnd() {
    dragItemId.current = null;
    setDragOverId(null);
  }

  return (
    <div className="space-y-8">
      {days.map(day => (
        <div key={day} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-3">
            <h3 className="font-semibold text-lg">Day {day}</h3>
          </div>
          <div className="p-6 space-y-6">
            {timeBlockOrder.filter(tb => byDay[day][tb]?.length > 0).map(timeBlock => (
              <div key={timeBlock}>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {timeBlockLabels[timeBlock]}
                </h4>
                <div className="space-y-3">
                  {byDay[day][timeBlock].map(item => (
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
                          : 'bg-gray-50'
                      }`}
                    >
                      <span className="text-xl mt-0.5 select-none">⠿</span>
                      <span className="text-xl mt-0.5">{typeIcons[item.proposal.type] || '📌'}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.proposal.title}</p>
                        <p className="text-sm text-gray-600">{item.proposal.description}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs text-gray-400">{item.proposal.city}</span>
                          {item.proposal.durationMinutes && (
                            <span className="text-xs text-gray-400">⏱ {item.proposal.durationMinutes}min</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

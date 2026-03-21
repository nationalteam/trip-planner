interface ItineraryItem {
  id: string;
  day: number;
  timeBlock: string;
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

const timeBlockOrder = ['morning', 'afternoon', 'dinner'];
const timeBlockLabels: Record<string, string> = {
  morning: '🌅 Morning',
  afternoon: '🌤 Afternoon',
  dinner: '🌙 Evening / Dinner',
};

const typeIcons: Record<string, string> = {
  food: '🍽️',
  place: '🏛️',
};

export default function ItineraryView({ items }: { items: ItineraryItem[] }) {
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
                    <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
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

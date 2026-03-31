'use client';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  reason: string;
  lat: number;
  lng: number;
  city: string;
  suggestedTime: string;
  durationMinutes: number | null;
  status: string;
}

interface ActivityCardProps {
  activity: Activity;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
}

const timeIcons: Record<string, string> = {
  morning: '🌅',
  lunch: '🌞',
  afternoon: '🌤',
  dinner: '🌙',
  night: '🌃',
};

const typeIcons: Record<string, string> = {
  food: '🍽️',
  place: '🏛️',
  hotel: '🏨',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 border-yellow-200 shadow-yellow-100/50',
  approved: 'bg-green-50 border-green-200 shadow-green-100/50',
  rejected: 'bg-red-50 border-red-200 shadow-red-100/50',
};

export default function ActivityCard({ activity, onApprove, onReject, onDelete, canEdit = true }: ActivityCardProps) {
  const placeQuery = [activity.title.trim(), activity.city.trim()].filter(Boolean).join(', ');
  const mapsQuery = encodeURIComponent(placeQuery || `${activity.lat},${activity.lng}`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className={`rounded-xl border p-5 transition-all shadow-sm hover:shadow-md ${statusColors[activity.status] || 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcons[activity.type] || '📌'}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{activity.title}</h3>
            <span className="text-xs text-gray-500">{activity.city} · {timeIcons[activity.suggestedTime]} {activity.suggestedTime}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
            activity.status === 'approved' ? 'bg-green-100 text-green-700' :
            activity.status === 'rejected' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {activity.status}
          </span>
          {onDelete && canEdit && (
            <button
              onClick={() => onDelete(activity.id)}
              aria-label="Delete activity"
              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-700 mb-2">{activity.description}</p>
      <p className="text-sm text-blue-600 italic mb-4">💡 {activity.reason}</p>

      {activity.durationMinutes && (
        <p className="text-xs text-gray-500 mb-4">⏱ ~{activity.durationMinutes} minutes</p>
      )}

      <p className="text-xs mb-4">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 hover:underline"
          aria-label="Open in Google Maps"
        >
          📍 Open in Google Maps
        </a>
      </p>

      {activity.status === 'pending' && canEdit && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(activity.id)}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onReject(activity.id)}
            className="flex-1 border border-red-300 text-red-600 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}

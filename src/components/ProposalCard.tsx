'use client';

interface Proposal {
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

interface ProposalCardProps {
  proposal: Proposal;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
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
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 border-yellow-200',
  approved: 'bg-green-50 border-green-200',
  rejected: 'bg-red-50 border-red-200',
};

export default function ProposalCard({ proposal, onApprove, onReject }: ProposalCardProps) {
  return (
    <div className={`rounded-xl border p-5 transition-all ${statusColors[proposal.status] || 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcons[proposal.type] || '📌'}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{proposal.title}</h3>
            <span className="text-xs text-gray-500">{proposal.city} · {timeIcons[proposal.suggestedTime]} {proposal.suggestedTime}</span>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
          proposal.status === 'approved' ? 'bg-green-100 text-green-700' :
          proposal.status === 'rejected' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {proposal.status}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-2">{proposal.description}</p>
      <p className="text-sm text-blue-600 italic mb-4">💡 {proposal.reason}</p>

      {proposal.durationMinutes && (
        <p className="text-xs text-gray-500 mb-4">⏱ ~{proposal.durationMinutes} minutes</p>
      )}

      {proposal.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(proposal.id)}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onReject(proposal.id)}
            className="flex-1 border border-red-300 text-red-600 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';

interface Trip {
  id: string;
  name: string;
  cities: string;
  createdAt: string;
  _count?: { proposals: number; itineraryItems: number };
}

export default function TripCard({ trip }: { trip: Trip }) {
  const cities: string[] = JSON.parse(trip.cities);
  const date = new Date(trip.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link href={`/trips/${trip.id}`} className="group">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {trip.name}
          </h3>
          <span className="text-2xl">✈️</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {cities.map(city => (
            <span key={city} className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
              📍 {city}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{date}</span>
          {trip._count && (
            <div className="flex gap-3">
              <span>{trip._count.proposals} proposals</span>
              <span>{trip._count.itineraryItems} planned</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

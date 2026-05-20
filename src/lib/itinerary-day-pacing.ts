export type ItineraryDayPaceLabel = 'Open day' | 'Relaxed pace' | 'Balanced pace' | 'Intensive pace';

export interface ItineraryDayPaceSummary {
  label: ItineraryDayPaceLabel;
  detail: string;
  totalMinutes: number;
  stopCount: number;
  unsizedCount: number;
}

function formatPlannedDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatStops(count: number): string {
  return `${count} ${count === 1 ? 'stop' : 'stops'}`;
}

function formatUnsizedStops(count: number): string {
  return `${count} unsized ${count === 1 ? 'stop' : 'stops'}`;
}

function classifyPace(totalMinutes: number): ItineraryDayPaceLabel {
  if (totalMinutes <= 0) return 'Open day';
  if (totalMinutes < 180) return 'Relaxed pace';
  if (totalMinutes <= 420) return 'Balanced pace';
  return 'Intensive pace';
}

export function summarizeItineraryDayPace(durations: Array<number | null>): ItineraryDayPaceSummary {
  const stopCount = durations.length;
  const timedDurations = durations.filter((duration): duration is number => (
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
  ));
  const totalMinutes = timedDurations.reduce((total, duration) => total + duration, 0);
  const unsizedCount = stopCount - timedDurations.length;
  const label = classifyPace(totalMinutes);

  if (stopCount === 0) {
    return {
      label,
      detail: 'No timed stops yet',
      totalMinutes,
      stopCount,
      unsizedCount,
    };
  }

  const detailParts = [formatStops(stopCount)];
  detailParts.push(totalMinutes > 0 ? `${formatPlannedDuration(totalMinutes)} planned` : 'No timed stops yet');

  if (unsizedCount > 0) {
    detailParts.push(formatUnsizedStops(unsizedCount));
  }

  return {
    label,
    detail: detailParts.join(' · '),
    totalMinutes,
    stopCount,
    unsizedCount,
  };
}

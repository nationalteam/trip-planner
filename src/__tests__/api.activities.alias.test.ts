import * as proposalsByTrip from '@/app/api/trips/[id]/proposals/route';
import * as activitiesByTrip from '@/app/api/trips/[id]/activities/route';
import * as proposalFill from '@/app/api/trips/[id]/proposals/fill/route';
import * as activityFill from '@/app/api/trips/[id]/activities/fill/route';

describe('activities API aliases', () => {
  it('aliases trip activity list/create to proposals handlers', () => {
    expect(activitiesByTrip.GET).toBe(proposalsByTrip.GET);
    expect(activitiesByTrip.POST).toBe(proposalsByTrip.POST);
  });

  it('aliases trip activity fill to proposal fill handler', () => {
    expect(activityFill.POST).toBe(proposalFill.POST);
  });
});

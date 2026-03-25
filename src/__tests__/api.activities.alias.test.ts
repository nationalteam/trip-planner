import * as proposalsByTrip from '@/app/api/trips/[id]/proposals/route';
import * as activitiesByTrip from '@/app/api/trips/[id]/activities/route';
import * as proposalFill from '@/app/api/trips/[id]/proposals/fill/route';
import * as activityFill from '@/app/api/trips/[id]/activities/fill/route';
import * as proposalById from '@/app/api/proposals/[id]/route';
import * as activityById from '@/app/api/activities/[id]/route';
import * as proposalApprove from '@/app/api/proposals/[id]/approve/route';
import * as activityApprove from '@/app/api/activities/[id]/approve/route';
import * as proposalReject from '@/app/api/proposals/[id]/reject/route';
import * as activityReject from '@/app/api/activities/[id]/reject/route';

describe('activities API aliases', () => {
  it('aliases trip activity list/create to proposals handlers', () => {
    expect(activitiesByTrip.GET).toBe(proposalsByTrip.GET);
    expect(activitiesByTrip.POST).toBe(proposalsByTrip.POST);
  });

  it('aliases trip activity fill to proposal fill handler', () => {
    expect(activityFill.POST).toBe(proposalFill.POST);
  });

  it('aliases activity by-id update/delete to proposal by-id handlers', () => {
    expect(activityById.PATCH).toBe(proposalById.PATCH);
    expect(activityById.DELETE).toBe(proposalById.DELETE);
  });

  it('aliases activity approve/reject to proposal approve/reject handlers', () => {
    expect(activityApprove.POST).toBe(proposalApprove.POST);
    expect(activityReject.POST).toBe(proposalReject.POST);
  });
});

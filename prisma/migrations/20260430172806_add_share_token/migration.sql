-- RedefineIndex
DROP INDEX "Proposal_tripId_googlePlaceId_key";
CREATE UNIQUE INDEX "Activity_tripId_googlePlaceId_key" ON "Activity"("tripId", "googlePlaceId");

-- RedefineIndex
DROP INDEX "ItineraryItem_proposalId_key";
CREATE UNIQUE INDEX "ItineraryItem_activityId_key" ON "ItineraryItem"("activityId");

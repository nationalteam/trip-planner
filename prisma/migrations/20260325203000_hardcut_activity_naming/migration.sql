PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

ALTER TABLE "Proposal" RENAME TO "Activity";
ALTER TABLE "ItineraryItem" RENAME COLUMN "proposalId" TO "activityId";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

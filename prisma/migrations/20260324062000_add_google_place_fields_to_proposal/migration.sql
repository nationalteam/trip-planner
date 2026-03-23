-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN "googlePlaceId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "formattedAddress" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "googleTypes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_tripId_googlePlaceId_key" ON "Proposal"("tripId", "googlePlaceId");

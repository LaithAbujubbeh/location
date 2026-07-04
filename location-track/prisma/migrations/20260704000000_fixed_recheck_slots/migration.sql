-- CreateTable
CREATE TABLE "EventRecheckSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRecheckSlot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "recheckCount",
DROP COLUMN "recheckDurationMinutes",
DROP COLUMN "recheckWindowMinutes";

-- AlterTable
ALTER TABLE "EventRecheck" ADD COLUMN "slotId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EventRecheckSlot_eventId_startsAt_key" ON "EventRecheckSlot"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "EventRecheckSlot_eventId_idx" ON "EventRecheckSlot"("eventId");

-- CreateIndex
CREATE INDEX "EventRecheckSlot_startsAt_idx" ON "EventRecheckSlot"("startsAt");

-- CreateIndex
CREATE INDEX "EventRecheckSlot_expiresAt_idx" ON "EventRecheckSlot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventRecheck_assignmentId_slotId_key" ON "EventRecheck"("assignmentId", "slotId");

-- CreateIndex
CREATE INDEX "EventRecheck_slotId_idx" ON "EventRecheck"("slotId");

-- AddForeignKey
ALTER TABLE "EventRecheckSlot" ADD CONSTRAINT "EventRecheckSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecheck" ADD CONSTRAINT "EventRecheck_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EventRecheckSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

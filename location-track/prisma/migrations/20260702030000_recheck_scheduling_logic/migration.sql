-- Align scheduled rechecks with the service contract used after check-in.
ALTER TABLE "EventRecheck" ADD COLUMN "employeeId" TEXT;

UPDATE "EventRecheck"
SET "employeeId" = "EventAssignment"."employeeId"
FROM "EventAssignment"
WHERE "EventRecheck"."assignmentId" = "EventAssignment"."id";

ALTER TABLE "EventRecheck" ALTER COLUMN "employeeId" SET NOT NULL;

DROP INDEX "EventRecheck_status_availableFrom_idx";

ALTER TABLE "EventRecheck" RENAME COLUMN "availableFrom" TO "startsAt";
ALTER TABLE "EventRecheck" DROP COLUMN "scheduledAt";

CREATE INDEX "EventRecheck_assignmentId_startsAt_idx" ON "EventRecheck"("assignmentId", "startsAt");
CREATE INDEX "EventRecheck_employeeId_status_idx" ON "EventRecheck"("employeeId", "status");
CREATE INDEX "EventRecheck_status_startsAt_idx" ON "EventRecheck"("status", "startsAt");

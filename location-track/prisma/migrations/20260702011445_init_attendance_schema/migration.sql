-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUSPICIOUS', 'FAILED', 'MISSED');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('CHECK_IN', 'RECHECK', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "RecheckStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'MISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'TRUSTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationName" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "checkoutRequired" BOOLEAN NOT NULL DEFAULT true,
    "rechecksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recheckCount" INTEGER NOT NULL DEFAULT 0,
    "recheckWindowMinutes" INTEGER,
    "recheckDurationMinutes" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAssignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventProof" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "recheckId" TEXT,
    "type" "ProofType" NOT NULL,
    "status" "ProofStatus" NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DOUBLE PRECISION NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "gpsTimestamp" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "rejectionCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRecheck" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "RecheckStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRecheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "label" TEXT,
    "userAgent" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_createdByUserId_startsAt_idx" ON "Event"("createdByUserId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_startsAt_endsAt_idx" ON "Event"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "EventAssignment_employeeId_status_idx" ON "EventAssignment"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EventAssignment_eventId_status_idx" ON "EventAssignment"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventAssignment_eventId_employeeId_key" ON "EventAssignment"("eventId", "employeeId");

-- CreateIndex
CREATE INDEX "EventProof_assignmentId_type_createdAt_idx" ON "EventProof"("assignmentId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "EventProof_recheckId_idx" ON "EventProof"("recheckId");

-- CreateIndex
CREATE INDEX "EventProof_status_createdAt_idx" ON "EventProof"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EventProof_deviceId_createdAt_idx" ON "EventProof"("deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventRecheck_tokenHash_key" ON "EventRecheck"("tokenHash");

-- CreateIndex
CREATE INDEX "EventRecheck_assignmentId_status_idx" ON "EventRecheck"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "EventRecheck_status_availableFrom_idx" ON "EventRecheck"("status", "availableFrom");

-- CreateIndex
CREATE INDEX "EventRecheck_status_expiresAt_idx" ON "EventRecheck"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "UserDevice_userId_status_idx" ON "UserDevice"("userId", "status");

-- CreateIndex
CREATE INDEX "UserDevice_status_createdAt_idx" ON "UserDevice"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserDevice_deviceId_idx" ON "UserDevice"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");

-- AddForeignKey
ALTER TABLE "EventAssignment" ADD CONSTRAINT "EventAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventProof" ADD CONSTRAINT "EventProof_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EventAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventProof" ADD CONSTRAINT "EventProof_recheckId_fkey" FOREIGN KEY ("recheckId") REFERENCES "EventRecheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecheck" ADD CONSTRAINT "EventRecheck_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EventAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

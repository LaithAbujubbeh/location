-- CreateIndex
CREATE INDEX "EventAssignment_eventId_createdAt_id_idx" ON "EventAssignment"("eventId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EventAssignment_eventId_checkedInAt_createdAt_id_idx" ON "EventAssignment"("eventId", "checkedInAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EventProof_assignmentId_createdAt_id_idx" ON "EventProof"("assignmentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "UserDevice_createdAt_id_idx" ON "UserDevice"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_status_createdAt_idx" ON "Review"("shop", "reviewType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_targetId_status_createdAt_idx" ON "Review"("shop", "reviewType", "targetId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_targetHandle_status_createdAt_idx" ON "Review"("shop", "reviewType", "targetHandle", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_productId_status_createdAt_idx" ON "Review"("shop", "reviewType", "productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_isPinned_createdAt_idx" ON "Review"("isPinned", "createdAt");

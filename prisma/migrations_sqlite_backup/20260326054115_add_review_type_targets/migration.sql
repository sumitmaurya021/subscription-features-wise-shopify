-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL DEFAULT 'product',
    "targetId" TEXT,
    "targetHandle" TEXT,
    "targetTitle" TEXT,
    "productId" TEXT,
    "productTitle" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "reviewImages" TEXT,
    "reviewVideoUrl" TEXT,
    "reviewYoutubeUrl" TEXT,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Review" ("createdAt", "customerEmail", "customerName", "helpfulCount", "id", "isPinned", "message", "productId", "productTitle", "rating", "reviewImages", "reviewVideoUrl", "reviewYoutubeUrl", "shop", "status", "title", "updatedAt") SELECT "createdAt", "customerEmail", "customerName", "helpfulCount", "id", "isPinned", "message", "productId", "productTitle", "rating", "reviewImages", "reviewVideoUrl", "reviewYoutubeUrl", "shop", "status", "title", "updatedAt" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_shop_reviewType_idx" ON "Review"("shop", "reviewType");
CREATE INDEX "Review_shop_reviewType_targetId_idx" ON "Review"("shop", "reviewType", "targetId");
CREATE INDEX "Review_shop_reviewType_targetHandle_idx" ON "Review"("shop", "reviewType", "targetHandle");
CREATE INDEX "Review_shop_productId_idx" ON "Review"("shop", "productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

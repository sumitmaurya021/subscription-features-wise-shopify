-- CreateTable
CREATE TABLE "PriceDropAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "productHandle" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "currentPrice" REAL NOT NULL,
    "targetPrice" REAL,
    "lastNotifiedPrice" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceDropAlert_shop_productId_customerEmail_key" ON "PriceDropAlert"("shop", "productId", "customerEmail");

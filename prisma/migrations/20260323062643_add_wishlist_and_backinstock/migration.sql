-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL DEFAULT '',
    "productTitle" TEXT,
    "productHandle" TEXT,
    "productImage" TEXT,
    "productUrl" TEXT,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "sessionId" TEXT,
    "ownerKey" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackInStockRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL DEFAULT '',
    "productTitle" TEXT,
    "productHandle" TEXT,
    "productImage" TEXT,
    "productUrl" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_shop_productId_variantId_ownerKey_key" ON "WishlistItem"("shop", "productId", "variantId", "ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockRequest_shop_productId_variantId_customerEmail_key" ON "BackInStockRequest"("shop", "productId", "variantId", "customerEmail");

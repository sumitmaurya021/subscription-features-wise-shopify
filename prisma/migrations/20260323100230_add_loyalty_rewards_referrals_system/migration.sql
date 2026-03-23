-- CreateTable
CREATE TABLE "LoyaltyCustomer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "sessionId" TEXT,
    "ownerKey" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePointsEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimePointsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "referralCode" TEXT NOT NULL,
    "referredByCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoyaltyPointEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "loyaltyCustomerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "reviewId" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyPointEvent_loyaltyCustomerId_fkey" FOREIGN KEY ("loyaltyCustomerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "loyaltyCustomerId" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "rewardTitle" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "pointsUsed" INTEGER NOT NULL,
    "rewardCode" TEXT,
    "rewardValue" REAL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardRedemption_loyaltyCustomerId_fkey" FOREIGN KEY ("loyaltyCustomerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferralInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referredEmail" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedOrderId" TEXT,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReferralInvite_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "LoyaltyCustomer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCustomer_referralCode_key" ON "LoyaltyCustomer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCustomer_shop_ownerKey_key" ON "LoyaltyCustomer"("shop", "ownerKey");

-- CreateIndex
CREATE INDEX "LoyaltyPointEvent_shop_loyaltyCustomerId_idx" ON "LoyaltyPointEvent"("shop", "loyaltyCustomerId");

-- CreateIndex
CREATE INDEX "RewardRedemption_shop_loyaltyCustomerId_idx" ON "RewardRedemption"("shop", "loyaltyCustomerId");

-- CreateIndex
CREATE INDEX "ReferralInvite_shop_referralCode_idx" ON "ReferralInvite"("shop", "referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralInvite_shop_referrerCustomerId_referredEmail_key" ON "ReferralInvite"("shop", "referrerCustomerId", "referredEmail");

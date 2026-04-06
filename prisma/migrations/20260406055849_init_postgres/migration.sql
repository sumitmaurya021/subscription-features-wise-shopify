-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackInStockRequest" (
    "id" TEXT NOT NULL,
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
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackInStockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceDropAlert" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "productHandle" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "lastNotifiedPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceDropAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyCustomer" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "loyaltyCustomerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "reviewId" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "loyaltyCustomerId" TEXT NOT NULL,
    "rewardKey" TEXT NOT NULL,
    "rewardTitle" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "pointsUsed" INTEGER NOT NULL,
    "rewardCode" TEXT,
    "rewardValue" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralInvite" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referredEmail" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedOrderId" TEXT,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_idx" ON "Review"("shop", "reviewType");

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_targetId_idx" ON "Review"("shop", "reviewType", "targetId");

-- CreateIndex
CREATE INDEX "Review_shop_reviewType_targetHandle_idx" ON "Review"("shop", "reviewType", "targetHandle");

-- CreateIndex
CREATE INDEX "Review_shop_productId_idx" ON "Review"("shop", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_shop_productId_variantId_ownerKey_key" ON "WishlistItem"("shop", "productId", "variantId", "ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockRequest_shop_productId_variantId_customerEmail_key" ON "BackInStockRequest"("shop", "productId", "variantId", "customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PriceDropAlert_shop_productId_customerEmail_key" ON "PriceDropAlert"("shop", "productId", "customerEmail");

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

-- AddForeignKey
ALTER TABLE "LoyaltyPointEvent" ADD CONSTRAINT "LoyaltyPointEvent_loyaltyCustomerId_fkey" FOREIGN KEY ("loyaltyCustomerId") REFERENCES "LoyaltyCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_loyaltyCustomerId_fkey" FOREIGN KEY ("loyaltyCustomerId") REFERENCES "LoyaltyCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralInvite" ADD CONSTRAINT "ReferralInvite_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "LoyaltyCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

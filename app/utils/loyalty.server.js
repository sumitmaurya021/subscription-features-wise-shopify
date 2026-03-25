import prisma from "../db.server";

export const LOYALTY_CONFIG = {
  points: {
    orderPaidMultiplier: 1,
    reviewApproved: 25,
    photoReviewBonus: 10,
    referralOrderReward: 100,
  },
  rewards: [
    {
      key: "FLAT250",
      title: "₹250 Off",
      type: "fixed",
      pointsCost: 250,
      value: 250,
    },
    {
      key: "PERCENT10",
      title: "10% Off",
      type: "percentage",
      pointsCost: 500,
      value: 10,
    },
  ],
  tiers: [
    { key: "bronze", minPoints: 0 },
    { key: "silver", minPoints: 500 },
    { key: "gold", minPoints: 1500 },
    { key: "platinum", minPoints: 3000 },
  ],
};

export function normalizeDate(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

export function createReferralCode(prefix = "REF") {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

export function resolveOwnerKey({ customerId, customerEmail, sessionId }) {
  return customerId || customerEmail || sessionId || null;
}

export function getTierFromLifetimePoints(points = 0) {
  const sorted = [...LOYALTY_CONFIG.tiers].sort(
    (a, b) => a.minPoints - b.minPoints,
  );
  let tier = "bronze";

  for (const item of sorted) {
    if (points >= item.minPoints) {
      tier = item.key;
    }
  }

  return tier;
}

export function normalizeLoyaltyCustomer(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt: normalizeDate(item.createdAt),
    updatedAt: normalizeDate(item.updatedAt),
  };
}

export function normalizePointEvent(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt: normalizeDate(item.createdAt),
  };
}

export function normalizeRewardRedemption(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt: normalizeDate(item.createdAt),
  };
}

export function normalizeReferralInvite(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt: normalizeDate(item.createdAt),
    updatedAt: normalizeDate(item.updatedAt),
  };
}

export async function getOrCreateLoyaltyCustomer({
  shop,
  customerId,
  customerEmail,
  sessionId,
  firstName,
  lastName,
  referredByCode,
}) {
  const ownerKey = resolveOwnerKey({ customerId, customerEmail, sessionId });

  if (!shop || !ownerKey) {
    throw new Error("shop and owner identifier are required");
  }

  let customer = await prisma.loyaltyCustomer.findUnique({
    where: {
      shop_ownerKey: {
        shop,
        ownerKey: String(ownerKey),
      },
    },
  });

  if (customer) {
    const nextLifetime = Number(customer.lifetimePointsEarned || 0);
    const nextTier = getTierFromLifetimePoints(nextLifetime);

    customer = await prisma.loyaltyCustomer.update({
      where: { id: customer.id },
      data: {
        customerId: customerId || customer.customerId,
        customerEmail: customerEmail || customer.customerEmail,
        sessionId: sessionId || customer.sessionId,
        firstName: firstName ?? customer.firstName,
        lastName: lastName ?? customer.lastName,
        referredByCode: customer.referredByCode || referredByCode || null,
        tier: nextTier,
      },
    });

    return normalizeLoyaltyCustomer(customer);
  }

  let referralCode = createReferralCode();

  while (
    await prisma.loyaltyCustomer.findUnique({
      where: { referralCode },
    })
  ) {
    referralCode = createReferralCode();
  }

  customer = await prisma.loyaltyCustomer.create({
    data: {
      shop,
      customerId: customerId || null,
      customerEmail: customerEmail || null,
      sessionId: sessionId || null,
      ownerKey: String(ownerKey),
      firstName: firstName || null,
      lastName: lastName || null,
      referralCode,
      referredByCode: referredByCode || null,
      tier: "bronze",
    },
  });

  return normalizeLoyaltyCustomer(customer);
}

export async function addPointsToCustomer({
  shop,
  loyaltyCustomerId,
  eventType,
  points,
  orderId,
  reviewId,
  note,
}) {
  if (!shop || !loyaltyCustomerId || !eventType) {
    throw new Error("Missing required point event fields");
  }

  const safePoints = Number(points);

  if (Number.isNaN(safePoints) || safePoints <= 0) {
    throw new Error("Points must be greater than 0");
  }

  if (orderId) {
    const existingOrderEvent = await prisma.loyaltyPointEvent.findFirst({
      where: {
        shop,
        loyaltyCustomerId,
        eventType,
        orderId: String(orderId),
      },
    });

    if (existingOrderEvent) {
      return {
        skipped: true,
        event: normalizePointEvent(existingOrderEvent),
      };
    }
  }

  if (reviewId) {
    const existingReviewEvent = await prisma.loyaltyPointEvent.findFirst({
      where: {
        shop,
        loyaltyCustomerId,
        eventType,
        reviewId: String(reviewId),
      },
    });

    if (existingReviewEvent) {
      return {
        skipped: true,
        event: normalizePointEvent(existingReviewEvent),
      };
    }
  }

  const customer = await prisma.loyaltyCustomer.findUnique({
    where: { id: loyaltyCustomerId },
  });

  if (!customer) {
    throw new Error("Loyalty customer not found");
  }

  const nextBalance = Number(customer.pointsBalance || 0) + safePoints;
  const nextLifetime =
    Number(customer.lifetimePointsEarned || 0) + Math.max(0, safePoints);
  const nextTier = getTierFromLifetimePoints(nextLifetime);

  const [event, updatedCustomer] = await prisma.$transaction([
    prisma.loyaltyPointEvent.create({
      data: {
        shop,
        loyaltyCustomerId,
        eventType,
        points: safePoints,
        orderId: orderId ? String(orderId) : null,
        reviewId: reviewId ? String(reviewId) : null,
        note: note || null,
      },
    }),
    prisma.loyaltyCustomer.update({
      where: { id: loyaltyCustomerId },
      data: {
        pointsBalance: nextBalance,
        lifetimePointsEarned: nextLifetime,
        tier: nextTier,
      },
    }),
  ]);

  return {
    skipped: false,
    event: normalizePointEvent(event),
    customer: normalizeLoyaltyCustomer(updatedCustomer),
  };
}

export async function redeemRewardForCustomer({
  shop,
  ownerKey,
  rewardKey,
  createDiscountCodeFn,
}) {
  if (!shop || !ownerKey || !rewardKey) {
    throw new Error("shop, ownerKey, rewardKey are required");
  }

  const reward = LOYALTY_CONFIG.rewards.find((item) => item.key === rewardKey);

  if (!reward) {
    throw new Error("Invalid reward selected");
  }

  const customer = await prisma.loyaltyCustomer.findUnique({
    where: {
      shop_ownerKey: {
        shop,
        ownerKey: String(ownerKey),
      },
    },
  });

  if (!customer) {
    throw new Error("Customer not found in loyalty program");
  }

  if (Number(customer.pointsBalance || 0) < Number(reward.pointsCost)) {
    throw new Error("Not enough points to redeem this reward");
  }

  const discountResult = await createDiscountCodeFn({
    shop,
    reward,
    customer,
  });

  const nextBalance =
    Number(customer.pointsBalance || 0) - Number(reward.pointsCost);

  const [redemption, updatedCustomer] = await prisma.$transaction([
    prisma.rewardRedemption.create({
      data: {
        shop,
        loyaltyCustomerId: customer.id,
        rewardKey: reward.key,
        rewardTitle: reward.title,
        rewardType: reward.type,
        pointsUsed: Number(reward.pointsCost),
        rewardCode: discountResult.code,
        rewardValue: Number(reward.value || 0),
        status: "issued",
      },
    }),
    prisma.loyaltyCustomer.update({
      where: { id: customer.id },
      data: {
        pointsBalance: nextBalance,
        lifetimePointsRedeemed:
          Number(customer.lifetimePointsRedeemed || 0) +
          Number(reward.pointsCost),
      },
    }),
  ]);

  return {
    redemption: normalizeRewardRedemption(redemption),
    customer: normalizeLoyaltyCustomer(updatedCustomer),
  };
}

export async function getOfflineAccessToken(shop) {
  const session = await prisma.session.findFirst({
    where: {
      shop,
      isOnline: false,
    },
  });

  return session?.accessToken || null;
}

export async function createShopifyDiscountCode({ shop, reward }) {
  const accessToken = await getOfflineAccessToken(shop);

  if (!accessToken) {
    throw new Error("Offline access token not found for this shop");
  }

  const code = `${reward.key}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const variables =
    reward.type === "fixed"
      ? {
          basicCodeDiscount: {
            title: reward.title,
            code,
            startsAt: new Date().toISOString(),
            customerSelection: {
              all: true,
            },
            customerGets: {
              value: {
                discountAmount: {
                  amount: String(Number(reward.value).toFixed(2)),
                  appliesOnEachItem: false,
                },
              },
              items: {
                all: true,
              },
            },
            appliesOncePerCustomer: true,
          },
        }
      : {
          basicCodeDiscount: {
            title: reward.title,
            code,
            startsAt: new Date().toISOString(),
            customerSelection: {
              all: true,
            },
            customerGets: {
              value: {
                percentage: Number(reward.value) / 100,
              },
              items: {
                all: true,
              },
            },
            appliesOncePerCustomer: true,
          },
        };

  const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query: `
        mutation CreateRewardDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  codes(first: 10) {
                    nodes {
                      code
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables,
    }),
  });

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message || "Shopify GraphQL request failed");
  }

  const userErrors = result?.data?.discountCodeBasicCreate?.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors[0]?.message || "Failed to create Shopify discount code");
  }

  const createdCode =
    result?.data?.discountCodeBasicCreate?.codeDiscountNode?.codeDiscount?.codes?.nodes?.[0]?.code;

  return {
    code: createdCode || code,
  };
}

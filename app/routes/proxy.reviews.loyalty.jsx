import { json } from "@remix-run/node";
import prisma from "../db.server";
import {
  LOYALTY_CONFIG,
  getOrCreateLoyaltyCustomer,
  resolveOwnerKey,
  createShopifyDiscountCode,
  redeemRewardForCustomer,
  normalizePointEvent,
  normalizeRewardRedemption,
  normalizeLoyaltyCustomer,
} from "../utils/loyalty.server";

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);

    const action = url.searchParams.get("action") || "status";
    const shop = url.searchParams.get("shop") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const customerEmail = url.searchParams.get("customerEmail") || "";
    const sessionId = url.searchParams.get("sessionId") || "";

    if (!shop) {
      return json({ success: false, message: "shop is required" }, { status: 400 });
    }

    if (action === "status") {
      const ownerKey = resolveOwnerKey({ customerId, customerEmail, sessionId });

      if (!ownerKey) {
        return json({
          success: true,
          data: {
            joined: false,
            customer: null,
            rewards: LOYALTY_CONFIG.rewards,
            pointEvents: [],
            redemptions: [],
          },
        });
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
        return json({
          success: true,
          data: {
            joined: false,
            customer: null,
            rewards: LOYALTY_CONFIG.rewards,
            pointEvents: [],
            redemptions: [],
          },
        });
      }

      const pointEvents = await prisma.loyaltyPointEvent.findMany({
        where: {
          shop,
          loyaltyCustomerId: customer.id,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      const redemptions = await prisma.rewardRedemption.findMany({
        where: {
          shop,
          loyaltyCustomerId: customer.id,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return json({
        success: true,
        data: {
          joined: true,
          customer: normalizeLoyaltyCustomer(customer),
          rewards: LOYALTY_CONFIG.rewards,
          pointEvents: pointEvents.map(normalizePointEvent),
          redemptions: redemptions.map(normalizeRewardRedemption),
        },
      });
    }

    return json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("LOYALTY PROXY LOADER ERROR:", error);
    return json({ success: false, message: "Failed to load loyalty data" }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "join") {
      const customer = await getOrCreateLoyaltyCustomer({
        shop: body.shop,
        customerId: body.customerId,
        customerEmail: body.customerEmail,
        sessionId: body.sessionId,
        firstName: body.firstName,
        lastName: body.lastName,
        referredByCode: body.referredByCode,
      });

      return json({
        success: true,
        message: "Joined loyalty program successfully",
        data: customer,
      });
    }

    if (action === "redeemReward") {
      const ownerKey = resolveOwnerKey({
        customerId: body.customerId,
        customerEmail: body.customerEmail,
        sessionId: body.sessionId,
      });

      if (!ownerKey) {
        return json(
          { success: false, message: "Customer identifier is required" },
          { status: 400 }
        );
      }

      const { redemption, customer } = await redeemRewardForCustomer({
        shop: body.shop,
        ownerKey,
        rewardKey: body.rewardKey,
        createDiscountCodeFn: createShopifyDiscountCode,
      });

      return json({
        success: true,
        message: "Reward redeemed successfully",
        data: {
          redemption,
          customer,
        },
      });
    }

    if (action === "createReferralInvite") {
      const ownerKey = resolveOwnerKey({
        customerId: body.customerId,
        customerEmail: body.customerEmail,
        sessionId: body.sessionId,
      });

      if (!body.shop || !ownerKey || !body.referredEmail) {
        return json(
          { success: false, message: "shop, owner identifier, referredEmail are required" },
          { status: 400 }
        );
      }

      const customer = await prisma.loyaltyCustomer.findUnique({
        where: {
          shop_ownerKey: {
            shop: body.shop,
            ownerKey: String(ownerKey),
          },
        },
      });

      if (!customer) {
        return json(
          { success: false, message: "Join loyalty program first" },
          { status: 400 }
        );
      }

      const referredEmail = String(body.referredEmail).trim().toLowerCase();

      const invite = await prisma.referralInvite.upsert({
        where: {
          shop_referrer_email: {
            shop: body.shop,
            referrerCustomerId: customer.id,
            referredEmail,
          },
        },
        update: {
          referralCode: customer.referralCode,
          status: "pending",
        },
        create: {
          shop: body.shop,
          referrerCustomerId: customer.id,
          referredEmail,
          referralCode: customer.referralCode,
          status: "pending",
        },
      });

      return json({
        success: true,
        message: "Referral saved successfully",
        data: invite,
      });
    }

    return json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("LOYALTY PROXY ACTION ERROR:", error);
    return json(
      { success: false, message: error.message || "Request failed" },
      { status: 500 }
    );
  }
};

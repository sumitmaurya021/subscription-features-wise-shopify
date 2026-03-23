import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  LOYALTY_CONFIG,
  getOrCreateLoyaltyCustomer,
  addPointsToCustomer,
} from "../utils/loyalty.server";

function getReferralCodeFromOrder(payload) {
  const noteAttributes = Array.isArray(payload?.note_attributes)
    ? payload.note_attributes
    : [];

  const fromNoteAttribute = noteAttributes.find(
    (item) =>
      item?.name === "_loyalty_referral_code" ||
      item?.key === "_loyalty_referral_code"
  );

  if (fromNoteAttribute?.value) {
    return String(fromNoteAttribute.value).trim();
  }

  const lineItems = Array.isArray(payload?.line_items) ? payload.line_items : [];

  for (const lineItem of lineItems) {
    const properties = Array.isArray(lineItem?.properties) ? lineItem.properties : [];

    const prop = properties.find(
      (item) =>
        item?.name === "_loyalty_referral_code" ||
        item?.key === "_loyalty_referral_code"
    );

    if (prop?.value) {
      return String(prop.value).trim();
    }
  }

  return "";
}

export const action = async ({ request }) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    if (topic !== "ORDERS_PAID") {
      return new Response("Unhandled topic", { status: 200 });
    }

    const orderId = String(payload?.id || "");
    const customerId = payload?.customer?.id ? String(payload.customer.id) : "";
    const customerEmail = String(
      payload?.email || payload?.customer?.email || ""
    )
      .trim()
      .toLowerCase();

    const firstName = payload?.customer?.first_name || "";
    const lastName = payload?.customer?.last_name || "";
    const totalPrice = Number(payload?.current_total_price || payload?.total_price || 0);

    if (!orderId || (!customerId && !customerEmail)) {
      return new Response("Missing customer information", { status: 200 });
    }

    const customer = await getOrCreateLoyaltyCustomer({
      shop,
      customerId,
      customerEmail,
      firstName,
      lastName,
    });

    const orderPoints = Math.max(
      1,
      Math.floor(totalPrice * Number(LOYALTY_CONFIG.points.orderPaidMultiplier || 1))
    );

    await addPointsToCustomer({
      shop,
      loyaltyCustomerId: customer.id,
      eventType: "ORDER_PAID",
      points: orderPoints,
      orderId,
      note: `Points earned from paid order ${orderId}`,
    });

    const referralCode = getReferralCodeFromOrder(payload);

    if (referralCode && customer.customerEmail) {
      const referrer = await prisma.loyaltyCustomer.findUnique({
        where: { referralCode },
      });

      if (
        referrer &&
        referrer.shop === shop &&
        referrer.id !== customer.id &&
        referrer.customerEmail !== customer.customerEmail
      ) {
        await prisma.referralInvite.upsert({
          where: {
            shop_referrer_email: {
              shop,
              referrerCustomerId: referrer.id,
              referredEmail: customer.customerEmail,
            },
          },
          update: {
            referralCode,
            status: "converted",
            convertedOrderId: orderId,
            rewardPoints: Number(LOYALTY_CONFIG.points.referralOrderReward || 100),
          },
          create: {
            shop,
            referrerCustomerId: referrer.id,
            referredEmail: customer.customerEmail,
            referralCode,
            status: "converted",
            convertedOrderId: orderId,
            rewardPoints: Number(LOYALTY_CONFIG.points.referralOrderReward || 100),
          },
        });

        await addPointsToCustomer({
          shop,
          loyaltyCustomerId: referrer.id,
          eventType: "REFERRAL_ORDER",
          points: Number(LOYALTY_CONFIG.points.referralOrderReward || 100),
          orderId,
          note: `Referral reward for order ${orderId}`,
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("ORDERS PAID WEBHOOK ERROR:", error);
    return new Response("Webhook failed", { status: 500 });
  }
};
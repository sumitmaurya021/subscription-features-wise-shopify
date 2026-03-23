import { json } from "@remix-run/node";
import prisma from "../db.server";

function normalizeWishlistItem(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt:
      item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : String(item.createdAt),
    updatedAt:
      item.updatedAt instanceof Date
        ? item.updatedAt.toISOString()
        : String(item.updatedAt),
  };
}

function normalizeBackInStock(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt:
      item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : String(item.createdAt),
    updatedAt:
      item.updatedAt instanceof Date
        ? item.updatedAt.toISOString()
        : String(item.updatedAt),
    notifiedAt: item.notifiedAt
      ? item.notifiedAt instanceof Date
        ? item.notifiedAt.toISOString()
        : String(item.notifiedAt)
      : null,
  };
}

function getOwnerKey({ customerId, customerEmail, sessionId }) {
  return customerId || customerEmail || sessionId || null;
}

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);

    const action = url.searchParams.get("action") || "status";
    const shop = url.searchParams.get("shop") || "";
    const productId = url.searchParams.get("productId") || "";
    const variantId = url.searchParams.get("variantId") || "";
    const customerId = url.searchParams.get("customerId") || "";
    const customerEmail = url.searchParams.get("customerEmail") || "";
    const sessionId = url.searchParams.get("sessionId") || "";

    if (!shop || !productId) {
      return json(
        { success: false, message: "shop and productId are required" },
        { status: 400 }
      );
    }

    const ownerKey = getOwnerKey({ customerId, customerEmail, sessionId });

    if (action === "status") {
      let isWishlisted = false;

      if (ownerKey) {
        const existingWishlist = await prisma.wishlistItem.findUnique({
          where: {
            shop_product_variant_ownerKey: {
              shop,
              productId: String(productId),
              variantId: String(variantId || ""),
              ownerKey: String(ownerKey),
            },
          },
        });

        isWishlisted = Boolean(existingWishlist);
      }

      const wishlistCount = await prisma.wishlistItem.count({
        where: {
          shop,
          productId: String(productId),
        },
      });

      let backInStockSubscribed = false;

      if (customerEmail) {
        const existingBis = await prisma.backInStockRequest.findUnique({
          where: {
            shop_product_variant_email: {
              shop,
              productId: String(productId),
              variantId: String(variantId || ""),
              customerEmail: String(customerEmail).trim().toLowerCase(),
            },
          },
        });

        backInStockSubscribed = Boolean(existingBis?.isActive);
      }

      return json({
        success: true,
        data: {
          isWishlisted,
          wishlistCount,
          backInStockSubscribed,
        },
      });
    }

    if (action === "list") {
      if (!ownerKey) {
        return json(
          { success: false, message: "owner identifier is required" },
          { status: 400 }
        );
      }

      const items = await prisma.wishlistItem.findMany({
        where: {
          shop,
          ownerKey: String(ownerKey),
        },
        orderBy: { createdAt: "desc" },
      });

      return json({
        success: true,
        count: items.length,
        data: items.map(normalizeWishlistItem),
      });
    }

    return json(
      { success: false, message: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("WISHLIST LOADER ERROR:", error);
    return json(
      { success: false, message: "Failed to process request" },
      { status: 500 }
    );
  }
};

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "toggleWishlist") {
      const {
        shop,
        productId,
        variantId,
        productTitle,
        productHandle,
        productImage,
        productUrl,
        customerId,
        customerEmail,
        sessionId,
      } = body;

      if (!shop || !productId) {
        return json(
          { success: false, message: "shop and productId are required" },
          { status: 400 }
        );
      }

      const ownerKey = getOwnerKey({ customerId, customerEmail, sessionId });

      if (!ownerKey) {
        return json(
          {
            success: false,
            message: "customerId, customerEmail, or sessionId is required",
          },
          { status: 400 }
        );
      }

      const where = {
        shop_product_variant_ownerKey: {
          shop,
          productId: String(productId),
          variantId: String(variantId || ""),
          ownerKey: String(ownerKey),
        },
      };

      const existing = await prisma.wishlistItem.findUnique({ where });

      if (existing) {
        const deleted = await prisma.wishlistItem.delete({
          where: { id: existing.id },
        });

        const wishlistCount = await prisma.wishlistItem.count({
          where: {
            shop,
            productId: String(productId),
          },
        });

        return json({
          success: true,
          action: "removed",
          message: "Removed from wishlist",
          wishlistCount,
          data: normalizeWishlistItem(deleted),
        });
      }

      const created = await prisma.wishlistItem.create({
        data: {
          shop,
          productId: String(productId),
          variantId: String(variantId || ""),
          productTitle: productTitle || null,
          productHandle: productHandle || null,
          productImage: productImage || null,
          productUrl: productUrl || null,
          customerId: customerId || null,
          customerEmail: customerEmail || null,
          sessionId: sessionId || null,
          ownerKey: String(ownerKey),
          ownerType: customerId || customerEmail ? "customer" : "guest",
        },
      });

      const wishlistCount = await prisma.wishlistItem.count({
        where: {
          shop,
          productId: String(productId),
        },
      });

      return json({
        success: true,
        action: "added",
        message: "Added to wishlist",
        wishlistCount,
        data: normalizeWishlistItem(created),
      });
    }

    if (action === "subscribeBackInStock") {
      const {
        shop,
        productId,
        variantId,
        productTitle,
        productHandle,
        productImage,
        productUrl,
        customerName,
        customerEmail,
      } = body;

      if (!shop || !productId || !customerEmail) {
        return json(
          {
            success: false,
            message: "shop, productId, customerEmail are required",
          },
          { status: 400 }
        );
      }

      const email = String(customerEmail).trim().toLowerCase();

      const saved = await prisma.backInStockRequest.upsert({
        where: {
          shop_product_variant_email: {
            shop,
            productId: String(productId),
            variantId: String(variantId || ""),
            customerEmail: email,
          },
        },
        update: {
          productTitle: productTitle || null,
          productHandle: productHandle || null,
          productImage: productImage || null,
          productUrl: productUrl || null,
          customerName: customerName || null,
          isActive: true,
          notifiedAt: null,
        },
        create: {
          shop,
          productId: String(productId),
          variantId: String(variantId || ""),
          productTitle: productTitle || null,
          productHandle: productHandle || null,
          productImage: productImage || null,
          productUrl: productUrl || null,
          customerName: customerName || null,
          customerEmail: email,
          isActive: true,
        },
      });

      return json({
        success: true,
        message: "You will be notified when the product is back in stock",
        data: normalizeBackInStock(saved),
      });
    }

    return json(
      { success: false, message: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("WISHLIST ACTION ERROR:", error);
    return json(
      { success: false, message: "Request failed" },
      { status: 500 }
    );
  }
};

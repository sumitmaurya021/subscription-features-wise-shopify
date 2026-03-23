import prisma from "../db.server";

function normalizeDate(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeWishlistItem(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt: normalizeDate(item.createdAt),
    updatedAt: normalizeDate(item.updatedAt),
  };
}

function normalizeBackInStockRequest(item) {
  if (!item) return null;

  return {
    ...item,
    createdAt: normalizeDate(item.createdAt),
    updatedAt: normalizeDate(item.updatedAt),
    notifiedAt: item.notifiedAt ? normalizeDate(item.notifiedAt) : null,
  };
}

export const typeDefs = /* GraphQL */ `
  type WishlistItem {
    id: ID!
    shop: String!
    productId: String!
    variantId: String!
    productTitle: String
    productHandle: String
    productImage: String
    productUrl: String
    customerId: String
    customerEmail: String
    sessionId: String
    ownerKey: String!
    ownerType: String!
    createdAt: String!
    updatedAt: String!
  }

  type BackInStockRequest {
    id: ID!
    shop: String!
    productId: String!
    variantId: String!
    productTitle: String
    productHandle: String
    productImage: String
    productUrl: String
    customerName: String
    customerEmail: String!
    isActive: Boolean!
    notifiedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type WishlistListResponse {
    success: Boolean!
    message: String
    count: Int!
    data: [WishlistItem!]!
  }

  type WishlistItemResponse {
    success: Boolean!
    message: String
    data: WishlistItem
  }

  type BackInStockListResponse {
    success: Boolean!
    message: String
    count: Int!
    data: [BackInStockRequest!]!
  }

  type BackInStockRequestResponse {
    success: Boolean!
    message: String
    data: BackInStockRequest
  }

  type WishlistStats {
    totalWishlistItems: Int!
    uniqueProductsWishlisted: Int!
    totalBackInStockSubscribers: Int!
    activeBackInStockSubscribers: Int!
  }

  type WishlistStatsResponse {
    success: Boolean!
    message: String
    data: WishlistStats
  }

  input WishlistInput {
    shop: String!
    productId: String!
    variantId: String
    productTitle: String
    productHandle: String
    productImage: String
    productUrl: String
    customerId: String
    customerEmail: String
    sessionId: String
  }

  input BackInStockInput {
    shop: String!
    productId: String!
    variantId: String
    productTitle: String
    productHandle: String
    productImage: String
    productUrl: String
    customerName: String
    customerEmail: String!
  }

  extend type Query {
    wishlistItems(shop: String, productId: String, ownerKey: String): WishlistListResponse!
    backInStockRequests(shop: String, productId: String, isActive: Boolean): BackInStockListResponse!
    wishlistStats(shop: String): WishlistStatsResponse!
  }

  extend type Mutation {
    addWishlistItem(input: WishlistInput!): WishlistItemResponse!
    removeWishlistItem(id: ID!): WishlistItemResponse!
    toggleWishlistItem(input: WishlistInput!): WishlistItemResponse!
    subscribeBackInStock(input: BackInStockInput!): BackInStockRequestResponse!
    unsubscribeBackInStock(id: ID!): BackInStockRequestResponse!
    markBackInStockNotified(id: ID!): BackInStockRequestResponse!
  }
`;

export const resolvers = {
  Query: {
    wishlistItems: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;
        if (args.productId) where.productId = String(args.productId);
        if (args.ownerKey) where.ownerKey = args.ownerKey;

        const items = await prisma.wishlistItem.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return {
          success: true,
          message: "Wishlist items fetched successfully",
          count: items.length,
          data: items.map(normalizeWishlistItem),
        };
      } catch (error) {
        console.error("GRAPHQL WISHLIST ITEMS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch wishlist items",
          count: 0,
          data: [],
        };
      }
    },

    backInStockRequests: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;
        if (args.productId) where.productId = String(args.productId);
        if (typeof args.isActive === "boolean") where.isActive = args.isActive;

        const items = await prisma.backInStockRequest.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return {
          success: true,
          message: "Back-in-stock requests fetched successfully",
          count: items.length,
          data: items.map(normalizeBackInStockRequest),
        };
      } catch (error) {
        console.error("GRAPHQL BACK IN STOCK LIST ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch back-in-stock requests",
          count: 0,
          data: [],
        };
      }
    },

    wishlistStats: async (_, { shop }) => {
      try {
        const where = {};
        const bisWhere = {};

        if (shop) {
          where.shop = shop;
          bisWhere.shop = shop;
        }

        const totalWishlistItems = await prisma.wishlistItem.count({ where });
        const totalBackInStockSubscribers = await prisma.backInStockRequest.count({
          where: bisWhere,
        });
        const activeBackInStockSubscribers = await prisma.backInStockRequest.count({
          where: {
            ...bisWhere,
            isActive: true,
          },
        });

        const uniqueProductsRaw = await prisma.wishlistItem.findMany({
          where,
          select: { productId: true },
          distinct: ["productId"],
        });

        return {
          success: true,
          message: "Wishlist stats fetched successfully",
          data: {
            totalWishlistItems,
            uniqueProductsWishlisted: uniqueProductsRaw.length,
            totalBackInStockSubscribers,
            activeBackInStockSubscribers,
          },
        };
      } catch (error) {
        console.error("GRAPHQL WISHLIST STATS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch wishlist stats",
          data: {
            totalWishlistItems: 0,
            uniqueProductsWishlisted: 0,
            totalBackInStockSubscribers: 0,
            activeBackInStockSubscribers: 0,
          },
        };
      }
    },
  },

  Mutation: {
    addWishlistItem: async (_, { input }) => {
      try {
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
        } = input;

        if (!shop || !productId) {
          return {
            success: false,
            message: "shop and productId are required",
            data: null,
          };
        }

        const ownerKey = customerId || customerEmail || sessionId;

        if (!ownerKey) {
          return {
            success: false,
            message: "customerId, customerEmail, or sessionId is required",
            data: null,
          };
        }

        const item = await prisma.wishlistItem.upsert({
          where: {
            shop_product_variant_ownerKey: {
              shop,
              productId: String(productId),
              variantId: String(variantId || ""),
              ownerKey: String(ownerKey),
            },
          },
          update: {
            productTitle: productTitle || null,
            productHandle: productHandle || null,
            productImage: productImage || null,
            productUrl: productUrl || null,
            customerId: customerId || null,
            customerEmail: customerEmail || null,
            sessionId: sessionId || null,
            ownerType: customerId || customerEmail ? "customer" : "guest",
          },
          create: {
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

        return {
          success: true,
          message: "Wishlist item saved successfully",
          data: normalizeWishlistItem(item),
        };
      } catch (error) {
        console.error("GRAPHQL ADD WISHLIST ERROR:", error);
        return {
          success: false,
          message: "Failed to save wishlist item",
          data: null,
        };
      }
    },

    removeWishlistItem: async (_, { id }) => {
      try {
        const existing = await prisma.wishlistItem.findUnique({ where: { id } });

        if (!existing) {
          return {
            success: false,
            message: "Wishlist item not found",
            data: null,
          };
        }

        const deleted = await prisma.wishlistItem.delete({ where: { id } });

        return {
          success: true,
          message: "Wishlist item removed successfully",
          data: normalizeWishlistItem(deleted),
        };
      } catch (error) {
        console.error("GRAPHQL REMOVE WISHLIST ERROR:", error);
        return {
          success: false,
          message: "Failed to remove wishlist item",
          data: null,
        };
      }
    },

    toggleWishlistItem: async (_, { input }) => {
      try {
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
        } = input;

        if (!shop || !productId) {
          return {
            success: false,
            message: "shop and productId are required",
            data: null,
          };
        }

        const ownerKey = customerId || customerEmail || sessionId;

        if (!ownerKey) {
          return {
            success: false,
            message: "customerId, customerEmail, or sessionId is required",
            data: null,
          };
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

          return {
            success: true,
            message: "Wishlist item removed successfully",
            data: normalizeWishlistItem(deleted),
          };
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

        return {
          success: true,
          message: "Wishlist item added successfully",
          data: normalizeWishlistItem(created),
        };
      } catch (error) {
        console.error("GRAPHQL TOGGLE WISHLIST ERROR:", error);
        return {
          success: false,
          message: "Failed to toggle wishlist item",
          data: null,
        };
      }
    },

    subscribeBackInStock: async (_, { input }) => {
      try {
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
        } = input;

        if (!shop || !productId || !customerEmail) {
          return {
            success: false,
            message: "shop, productId, customerEmail are required",
            data: null,
          };
        }

        const email = String(customerEmail).trim().toLowerCase();

        const item = await prisma.backInStockRequest.upsert({
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

        return {
          success: true,
          message: "Back-in-stock request saved successfully",
          data: normalizeBackInStockRequest(item),
        };
      } catch (error) {
        console.error("GRAPHQL SUBSCRIBE BACK IN STOCK ERROR:", error);
        return {
          success: false,
          message: "Failed to save back-in-stock request",
          data: null,
        };
      }
    },

    unsubscribeBackInStock: async (_, { id }) => {
      try {
        const existing = await prisma.backInStockRequest.findUnique({
          where: { id },
        });

        if (!existing) {
          return {
            success: false,
            message: "Back-in-stock request not found",
            data: null,
          };
        }

        const updated = await prisma.backInStockRequest.update({
          where: { id },
          data: { isActive: false },
        });

        return {
          success: true,
          message: "Back-in-stock request unsubscribed successfully",
          data: normalizeBackInStockRequest(updated),
        };
      } catch (error) {
        console.error("GRAPHQL UNSUBSCRIBE BACK IN STOCK ERROR:", error);
        return {
          success: false,
          message: "Failed to unsubscribe request",
          data: null,
        };
      }
    },

    markBackInStockNotified: async (_, { id }) => {
      try {
        const existing = await prisma.backInStockRequest.findUnique({
          where: { id },
        });

        if (!existing) {
          return {
            success: false,
            message: "Back-in-stock request not found",
            data: null,
          };
        }

        const updated = await prisma.backInStockRequest.update({
          where: { id },
          data: {
            isActive: false,
            notifiedAt: new Date(),
          },
        });

        return {
          success: true,
          message: "Back-in-stock request marked as notified",
          data: normalizeBackInStockRequest(updated),
        };
      } catch (error) {
        console.error("GRAPHQL MARK NOTIFIED ERROR:", error);
        return {
          success: false,
          message: "Failed to mark request notified",
          data: null,
        };
      }
    },
  },
};
import prisma from "../db.server";
import {
  LOYALTY_CONFIG,
  normalizeLoyaltyCustomer,
  normalizePointEvent,
  normalizeRewardRedemption,
  normalizeReferralInvite,
  getOrCreateLoyaltyCustomer,
  resolveOwnerKey,
  addPointsToCustomer,
  redeemRewardForCustomer,
  createShopifyDiscountCode,
} from "../utils/loyalty.server";

export const typeDefs = /* GraphQL */ `
  type LoyaltyCustomer {
    id: ID!
    shop: String!
    customerId: String
    customerEmail: String
    sessionId: String
    ownerKey: String!
    firstName: String
    lastName: String
    pointsBalance: Int!
    lifetimePointsEarned: Int!
    lifetimePointsRedeemed: Int!
    tier: String!
    referralCode: String!
    referredByCode: String
    createdAt: String!
    updatedAt: String!
  }

  type LoyaltyPointEvent {
    id: ID!
    shop: String!
    loyaltyCustomerId: String!
    eventType: String!
    points: Int!
    orderId: String
    reviewId: String
    note: String
    status: String!
    createdAt: String!
  }

  type RewardRedemption {
    id: ID!
    shop: String!
    loyaltyCustomerId: String!
    rewardKey: String!
    rewardTitle: String!
    rewardType: String!
    pointsUsed: Int!
    rewardCode: String
    rewardValue: Float
    status: String!
    createdAt: String!
  }

  type ReferralInvite {
    id: ID!
    shop: String!
    referrerCustomerId: String!
    referredEmail: String!
    referralCode: String!
    status: String!
    convertedOrderId: String
    rewardPoints: Int!
    createdAt: String!
    updatedAt: String!
  }

  type LoyaltyRewardOption {
    key: String!
    title: String!
    type: String!
    pointsCost: Int!
    value: Float!
  }

  type LoyaltyStats {
    totalMembers: Int!
    activePointHolders: Int!
    totalPointsIssued: Int!
    totalPointsRedeemed: Int!
    totalReferralInvites: Int!
    convertedReferrals: Int!
  }

  type LoyaltyCustomerListResponse {
    success: Boolean!
    message: String
    count: Int!
    data: [LoyaltyCustomer!]!
  }

  type LoyaltyPointEventListResponse {
    success: Boolean!
    message: String
    count: Int!
    data: [LoyaltyPointEvent!]!
  }

  type RewardRedemptionListResponse {
    success: Boolean!
    message: String
    count: Int!
    data: [RewardRedemption!]!
  }

  type ReferralInviteListResponse {
    success: Boolean!
    message: String
    count: Int!
    data: [ReferralInvite!]!
  }

  type LoyaltyStatsResponse {
    success: Boolean!
    message: String
    data: LoyaltyStats
  }

  type LoyaltyRewardOptionListResponse {
    success: Boolean!
    message: String
    data: [LoyaltyRewardOption!]!
  }

  type LoyaltyCustomerResponse {
    success: Boolean!
    message: String
    data: LoyaltyCustomer
  }

  type RewardRedemptionResponse {
    success: Boolean!
    message: String
    data: RewardRedemption
  }

  input LoyaltyCustomerInput {
    shop: String!
    customerId: String
    customerEmail: String
    sessionId: String
    firstName: String
    lastName: String
    referredByCode: String
  }

  input ManualPointsInput {
    customerId: ID!
    points: Int!
    note: String
  }

  input RewardRedeemInput {
    shop: String!
    ownerKey: String!
    rewardKey: String!
  }

  input ReferralInviteInput {
    shop: String!
    ownerKey: String!
    referredEmail: String!
  }

  extend type Query {
    loyaltyCustomers(shop: String, search: String): LoyaltyCustomerListResponse!
    loyaltyPointEvents(shop: String, ownerKey: String): LoyaltyPointEventListResponse!
    rewardRedemptions(shop: String, status: String): RewardRedemptionListResponse!
    referralInvites(shop: String, status: String): ReferralInviteListResponse!
    loyaltyStats(shop: String): LoyaltyStatsResponse!
    loyaltyRewardOptions: LoyaltyRewardOptionListResponse!
  }

  extend type Mutation {
    syncLoyaltyCustomer(input: LoyaltyCustomerInput!): LoyaltyCustomerResponse!
    addManualLoyaltyPoints(input: ManualPointsInput!): LoyaltyCustomerResponse!
    redeemLoyaltyReward(input: RewardRedeemInput!): RewardRedemptionResponse!
    createReferralInvite(input: ReferralInviteInput!): ReferralInviteListResponse!
  }
`;

export const resolvers = {
  Query: {
    loyaltyCustomers: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;

        if (args.search) {
          where.OR = [
            { customerEmail: { contains: args.search } },
            { firstName: { contains: args.search } },
            { lastName: { contains: args.search } },
            { referralCode: { contains: args.search } },
          ];
        }

        const items = await prisma.loyaltyCustomer.findMany({
          where,
          orderBy: [{ pointsBalance: "desc" }, { createdAt: "desc" }],
        });

        return {
          success: true,
          message: "Loyalty customers fetched successfully",
          count: items.length,
          data: items.map(normalizeLoyaltyCustomer),
        };
      } catch (error) {
        console.error("LOYALTY CUSTOMERS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch loyalty customers",
          count: 0,
          data: [],
        };
      }
    },

    loyaltyPointEvents: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;

        if (args.ownerKey) {
          const customer = await prisma.loyaltyCustomer.findFirst({
            where: { ownerKey: args.ownerKey, ...(args.shop ? { shop: args.shop } : {}) },
          });

          if (!customer) {
            return {
              success: true,
              message: "No loyalty events found",
              count: 0,
              data: [],
            };
          }

          where.loyaltyCustomerId = customer.id;
        }

        const items = await prisma.loyaltyPointEvent.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return {
          success: true,
          message: "Point events fetched successfully",
          count: items.length,
          data: items.map(normalizePointEvent),
        };
      } catch (error) {
        console.error("LOYALTY EVENTS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch loyalty events",
          count: 0,
          data: [],
        };
      }
    },

    rewardRedemptions: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;
        if (args.status) where.status = args.status;

        const items = await prisma.rewardRedemption.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return {
          success: true,
          message: "Reward redemptions fetched successfully",
          count: items.length,
          data: items.map(normalizeRewardRedemption),
        };
      } catch (error) {
        console.error("REWARD REDEMPTIONS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch reward redemptions",
          count: 0,
          data: [],
        };
      }
    },

    referralInvites: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;
        if (args.status) where.status = args.status;

        const items = await prisma.referralInvite.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return {
          success: true,
          message: "Referral invites fetched successfully",
          count: items.length,
          data: items.map(normalizeReferralInvite),
        };
      } catch (error) {
        console.error("REFERRAL INVITES ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch referral invites",
          count: 0,
          data: [],
        };
      }
    },

    loyaltyStats: async (_, { shop }) => {
      try {
        const where = shop ? { shop } : {};

        const totalMembers = await prisma.loyaltyCustomer.count({ where });
        const activePointHolders = await prisma.loyaltyCustomer.count({
          where: {
            ...where,
            pointsBalance: { gt: 0 },
          },
        });

        const events = await prisma.loyaltyPointEvent.findMany({
          where,
          select: { points: true },
        });

        const redemptions = await prisma.rewardRedemption.findMany({
          where,
          select: { pointsUsed: true },
        });

        const totalReferralInvites = await prisma.referralInvite.count({ where });
        const convertedReferrals = await prisma.referralInvite.count({
          where: {
            ...where,
            status: "converted",
          },
        });

        return {
          success: true,
          message: "Loyalty stats fetched successfully",
          data: {
            totalMembers,
            activePointHolders,
            totalPointsIssued: events.reduce((sum, item) => sum + Number(item.points || 0), 0),
            totalPointsRedeemed: redemptions.reduce(
              (sum, item) => sum + Number(item.pointsUsed || 0),
              0
            ),
            totalReferralInvites,
            convertedReferrals,
          },
        };
      } catch (error) {
        console.error("LOYALTY STATS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch loyalty stats",
          data: {
            totalMembers: 0,
            activePointHolders: 0,
            totalPointsIssued: 0,
            totalPointsRedeemed: 0,
            totalReferralInvites: 0,
            convertedReferrals: 0,
          },
        };
      }
    },

    loyaltyRewardOptions: async () => {
      return {
        success: true,
        message: "Reward options fetched successfully",
        data: LOYALTY_CONFIG.rewards.map((item) => ({
          key: item.key,
          title: item.title,
          type: item.type,
          pointsCost: item.pointsCost,
          value: Number(item.value),
        })),
      };
    },
  },

  Mutation: {
    syncLoyaltyCustomer: async (_, { input }) => {
      try {
        const item = await getOrCreateLoyaltyCustomer(input);

        return {
          success: true,
          message: "Loyalty customer synced successfully",
          data: item,
        };
      } catch (error) {
        console.error("SYNC LOYALTY CUSTOMER ERROR:", error);
        return {
          success: false,
          message: error.message || "Failed to sync loyalty customer",
          data: null,
        };
      }
    },

    addManualLoyaltyPoints: async (_, { input }) => {
    try {
        const customer = await prisma.loyaltyCustomer.findUnique({
        where: { id: input.customerId },
        });

        if (!customer) {
        return {
            success: false,
            message: "Customer not found",
            data: null,
        };
        }

        const points = Number(input.points);

        if (Number.isNaN(points) || points <= 0) {
        return {
            success: false,
            message: "Points must be greater than 0",
            data: null,
        };
        }

        await addPointsToCustomer({
        shop: customer.shop,
        loyaltyCustomerId: customer.id,
        eventType: "MANUAL_ADMIN_CREDIT",
        points,
        note: input.note || "Manual admin credit",
        });

        const updated = await prisma.loyaltyCustomer.findUnique({
        where: { id: customer.id },
        });

        return {
        success: true,
        message: "Points added successfully",
        data: normalizeLoyaltyCustomer(updated),
        };
    } catch (error) {
        console.error("MANUAL POINTS ERROR:", error);
        return {
        success: false,
        message: error.message || "Failed to add manual points",
        data: null,
        };
    }
    },

    redeemLoyaltyReward: async (_, { input }) => {
      try {
        const { redemption } = await redeemRewardForCustomer({
          shop: input.shop,
          ownerKey: input.ownerKey,
          rewardKey: input.rewardKey,
          createDiscountCodeFn: createShopifyDiscountCode,
        });

        return {
          success: true,
          message: "Reward redeemed successfully",
          data: redemption,
        };
      } catch (error) {
        console.error("REDEEM LOYALTY REWARD ERROR:", error);
        return {
          success: false,
          message: error.message || "Failed to redeem reward",
          data: null,
        };
      }
    },

    createReferralInvite: async (_, { input }) => {
      try {
        const customer = await prisma.loyaltyCustomer.findUnique({
          where: {
            shop_ownerKey: {
              shop: input.shop,
              ownerKey: input.ownerKey,
            },
          },
        });

        if (!customer) {
          return {
            success: false,
            message: "Loyalty customer not found",
            count: 0,
            data: [],
          };
        }

        const referredEmail = String(input.referredEmail).trim().toLowerCase();

        const item = await prisma.referralInvite.upsert({
          where: {
            shop_referrer_email: {
              shop: input.shop,
              referrerCustomerId: customer.id,
              referredEmail,
            },
          },
          update: {
            referralCode: customer.referralCode,
            status: "pending",
          },
          create: {
            shop: input.shop,
            referrerCustomerId: customer.id,
            referredEmail,
            referralCode: customer.referralCode,
            status: "pending",
          },
        });

        return {
          success: true,
          message: "Referral invite created successfully",
          count: 1,
          data: [normalizeReferralInvite(item)],
        };
      } catch (error) {
        console.error("CREATE REFERRAL INVITE ERROR:", error);
        return {
          success: false,
          message: error.message || "Failed to create referral invite",
          count: 0,
          data: [],
        };
      }
    },
  },
};

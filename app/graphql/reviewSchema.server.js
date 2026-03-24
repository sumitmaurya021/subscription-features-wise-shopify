import prisma from "../db.server";
import {
  LOYALTY_CONFIG,
  getOrCreateLoyaltyCustomer,
  addPointsToCustomer,
} from "../utils/loyalty.server";

function parseReviewImages(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeYoutubeUrl(value) {
  if (!value) return null;

  const url = String(value).trim();

  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      let videoId = "";

      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "").trim();
      } else if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
      }

      if (!videoId) return null;

      return `https://www.youtube.com/embed/${videoId}`;
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeVideoUrl(value) {
  if (!value) return null;

  const url = String(value).trim();
  return url || null;
}

function normalizeReview(review) {
  if (!review) return null;

  return {
    ...review,
    reviewImages: parseReviewImages(review.reviewImages),
    reviewVideoUrl: review.reviewVideoUrl || null,
    reviewYoutubeUrl: review.reviewYoutubeUrl || null,
    helpfulCount: Number(review.helpfulCount || 0),
    isPinned: Boolean(review.isPinned),
    createdAt:
      review.createdAt instanceof Date
        ? review.createdAt.toISOString()
        : String(review.createdAt),
    updatedAt:
      review.updatedAt instanceof Date
        ? review.updatedAt.toISOString()
        : String(review.updatedAt),
  };
}

export const typeDefs = /* GraphQL */ `
  type Review {
    id: ID!
    shop: String!
    productId: String!
    productTitle: String
    customerName: String!
    customerEmail: String
    rating: Int!
    title: String
    message: String!
    reviewImages: [String!]!
    reviewVideoUrl: String
    reviewYoutubeUrl: String
    helpfulCount: Int!
    status: String!
    isPinned: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type ReviewListResponse {
    success: Boolean!
    message: String
    count: Int
    data: [Review!]!
  }

  type ReviewResponse {
    success: Boolean!
    message: String
    data: Review
  }

  type ProductReviewsResponse {
    success: Boolean!
    message: String
    totalReviews: Int!
    averageRating: Float!
    data: [Review!]!
  }

  input CreateReviewInput {
    shop: String!
    productId: String!
    productTitle: String
    customerName: String!
    customerEmail: String
    rating: Int!
    title: String
    message: String!
    reviewImages: [String!]
    reviewVideoUrl: String
    reviewYoutubeUrl: String
  }

  input UpdateReviewInput {
    productTitle: String
    customerName: String
    customerEmail: String
    rating: Int
    title: String
    message: String
    reviewImages: [String!]
    reviewVideoUrl: String
    reviewYoutubeUrl: String
    status: String
    isPinned: Boolean
  }

  type Query {
    reviews(shop: String, status: String, productId: String): ReviewListResponse!
    review(id: ID!): ReviewResponse!
    productReviews(productId: String!, shop: String): ProductReviewsResponse!
  }

  type Mutation {
    createReview(input: CreateReviewInput!): ReviewResponse!
    updateReview(id: ID!, input: UpdateReviewInput!): ReviewResponse!
    deleteReview(id: ID!): ReviewResponse!
    approveReview(id: ID!): ReviewResponse!
    rejectReview(id: ID!): ReviewResponse!
    toggleReviewHelpful(id: ID!, increment: Boolean!): ReviewResponse!
    pinReview(id: ID!): ReviewResponse!
    unpinReview(id: ID!): ReviewResponse!
  }
`;

export const resolvers = {
  Query: {
    reviews: async (_, args) => {
      try {
        const where = {};

        if (args.shop) where.shop = args.shop;
        if (args.status) where.status = args.status;
        if (args.productId) where.productId = String(args.productId);

        const reviews = await prisma.review.findMany({
          where,
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        });

        return {
          success: true,
          message: "Reviews fetched successfully",
          count: reviews.length,
          data: reviews.map(normalizeReview),
        };
      } catch (error) {
        console.error("GRAPHQL REVIEWS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch reviews",
          count: 0,
          data: [],
        };
      }
    },

    review: async (_, { id }) => {
      try {
        const review = await prisma.review.findUnique({
          where: { id },
        });

        if (!review) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        return {
          success: true,
          message: "Review fetched successfully",
          data: normalizeReview(review),
        };
      } catch (error) {
        console.error("GRAPHQL SINGLE REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch review",
          data: null,
        };
      }
    },

    productReviews: async (_, { productId, shop }) => {
      try {
        const where = {
          productId: String(productId),
          status: "approved",
        };

        if (shop) where.shop = shop;

        const reviews = await prisma.review.findMany({
          where,
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        });

        const totalReviews = reviews.length;
        const averageRating =
          totalReviews > 0
            ? reviews.reduce((sum, item) => sum + item.rating, 0) / totalReviews
            : 0;

        return {
          success: true,
          message: "Product reviews fetched successfully",
          totalReviews,
          averageRating: Number(averageRating.toFixed(1)),
          data: reviews.map(normalizeReview),
        };
      } catch (error) {
        console.error("GRAPHQL PRODUCT REVIEWS ERROR:", error);
        return {
          success: false,
          message: "Failed to fetch product reviews",
          totalReviews: 0,
          averageRating: 0,
          data: [],
        };
      }
    },
  },

  Mutation: {
    createReview: async (_, { input }) => {
      try {
        const {
          shop,
          productId,
          productTitle,
          customerName,
          customerEmail,
          rating,
          title,
          message,
          reviewImages,
          reviewVideoUrl,
          reviewYoutubeUrl,
        } = input;

        if (!shop || !productId || !customerName || !rating || !message) {
          return {
            success: false,
            message:
              "shop, productId, customerName, rating, message are required",
            data: null,
          };
        }

        const parsedRating = Number(rating);

        if (parsedRating < 1 || parsedRating > 5) {
          return {
            success: false,
            message: "Rating must be between 1 and 5",
            data: null,
          };
        }

        const normalizedImages = Array.isArray(reviewImages)
          ? reviewImages.filter(
              (item) => typeof item === "string" && item.trim() !== ""
            )
          : [];

        if (normalizedImages.length > 4) {
          return {
            success: false,
            message: "You can upload up to 4 images only",
            data: null,
          };
        }

        const normalizedVideoUrl = normalizeVideoUrl(reviewVideoUrl);
        const normalizedYoutubeUrl = normalizeYoutubeUrl(reviewYoutubeUrl);

        if (reviewYoutubeUrl && !normalizedYoutubeUrl) {
          return {
            success: false,
            message: "Please enter a valid YouTube link",
            data: null,
          };
        }

        const review = await prisma.review.create({
          data: {
            shop,
            productId: String(productId),
            productTitle: productTitle || null,
            customerName,
            customerEmail: customerEmail || null,
            rating: parsedRating,
            title: title || null,
            message,
            reviewImages: normalizedImages.length
              ? JSON.stringify(normalizedImages)
              : null,
            reviewVideoUrl: normalizedVideoUrl,
            reviewYoutubeUrl: normalizedYoutubeUrl,
            helpfulCount: 0,
            status: "pending",
          },
        });

        return {
          success: true,
          message: "Review created successfully",
          data: normalizeReview(review),
        };
      } catch (error) {
        console.error("GRAPHQL CREATE REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to create review",
          data: null,
        };
      }
    },

    updateReview: async (_, { id, input }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        if (input.rating !== undefined) {
          const parsedRating = Number(input.rating);

          if (parsedRating < 1 || parsedRating > 5) {
            return {
              success: false,
              message: "Rating must be between 1 and 5",
              data: null,
            };
          }
        }

        if (
          input.reviewYoutubeUrl !== undefined &&
          input.reviewYoutubeUrl &&
          !normalizeYoutubeUrl(input.reviewYoutubeUrl)
        ) {
          return {
            success: false,
            message: "Please enter a valid YouTube link",
            data: null,
          };
        }

        if (input.isPinned === true && !existingReview.isPinned) {
          const pinnedCount = await prisma.review.count({
            where: {
              shop: existingReview.shop,
              productId: existingReview.productId,
              isPinned: true,
            },
          });

          if (pinnedCount >= 3) {
            return {
              success: false,
              message: "You can pin maximum 3 reviews only for this product.",
              data: null,
            };
          }
        }

        let nextReviewImages;

        if (input.reviewImages !== undefined) {
          const normalizedImages = Array.isArray(input.reviewImages)
            ? input.reviewImages.filter(
                (item) => typeof item === "string" && item.trim() !== ""
              )
            : [];

          if (normalizedImages.length > 4) {
            return {
              success: false,
              message: "You can upload up to 4 images only",
              data: null,
            };
          }

          nextReviewImages = normalizedImages.length
            ? JSON.stringify(normalizedImages)
            : null;
        }

        const updatedReview = await prisma.review.update({
          where: { id },
          data: {
            productTitle: input.productTitle ?? existingReview.productTitle,
            customerName: input.customerName ?? existingReview.customerName,
            customerEmail: input.customerEmail ?? existingReview.customerEmail,
            rating:
              input.rating !== undefined
                ? Number(input.rating)
                : existingReview.rating,
            title: input.title ?? existingReview.title,
            message: input.message ?? existingReview.message,
            reviewImages:
              input.reviewImages !== undefined
                ? nextReviewImages
                : existingReview.reviewImages,
            reviewVideoUrl:
              input.reviewVideoUrl !== undefined
                ? normalizeVideoUrl(input.reviewVideoUrl)
                : existingReview.reviewVideoUrl,
            reviewYoutubeUrl:
              input.reviewYoutubeUrl !== undefined
                ? normalizeYoutubeUrl(input.reviewYoutubeUrl)
                : existingReview.reviewYoutubeUrl,
            status: input.status ?? existingReview.status,
            isPinned:
              input.isPinned !== undefined
                ? Boolean(input.isPinned)
                : existingReview.isPinned,
          },
        });

        return {
          success: true,
          message: "Review updated successfully",
          data: normalizeReview(updatedReview),
        };
      } catch (error) {
        console.error("GRAPHQL UPDATE REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to update review",
          data: null,
        };
      }
    },

    deleteReview: async (_, { id }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        const deletedReview = await prisma.review.delete({
          where: { id },
        });

        return {
          success: true,
          message: "Review deleted successfully",
          data: normalizeReview(deletedReview),
        };
      } catch (error) {
        console.error("GRAPHQL DELETE REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to delete review",
          data: null,
        };
      }
    },

    approveReview: async (_, { id }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        const updatedReview = await prisma.review.update({
          where: { id },
          data: {
            status: "approved",
          },
        });

        if (updatedReview.customerEmail) {
          try {
            const loyaltyCustomer = await getOrCreateLoyaltyCustomer({
              shop: updatedReview.shop,
              customerEmail: updatedReview.customerEmail,
              firstName: updatedReview.customerName,
            });

            const normalizedReview = normalizeReview(updatedReview);

            await addPointsToCustomer({
              shop: updatedReview.shop,
              loyaltyCustomerId: loyaltyCustomer.id,
              eventType: "REVIEW_APPROVED",
              points:
                Number(LOYALTY_CONFIG.points.reviewApproved || 25) +
                (Array.isArray(normalizedReview?.reviewImages) &&
                normalizedReview.reviewImages.length > 0
                  ? Number(LOYALTY_CONFIG.points.photoReviewBonus || 10)
                  : 0),
              reviewId: updatedReview.id,
              note: "Points for approved review",
            });
          } catch (loyaltyError) {
            console.error("REVIEW LOYALTY CREDIT ERROR:", loyaltyError);
          }
        }

        return {
          success: true,
          message: "Review approved successfully",
          data: normalizeReview(updatedReview),
        };
      } catch (error) {
        console.error("GRAPHQL APPROVE REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to approve review",
          data: null,
        };
      }
    },

    rejectReview: async (_, { id }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        const updatedReview = await prisma.review.update({
          where: { id },
          data: {
            status: "rejected",
          },
        });

        return {
          success: true,
          message: "Review rejected successfully",
          data: normalizeReview(updatedReview),
        };
      } catch (error) {
        console.error("GRAPHQL REJECT REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to reject review",
          data: null,
        };
      }
    },

    toggleReviewHelpful: async (_, { id, increment }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        const currentHelpfulCount = Number(existingReview.helpfulCount || 0);
        const nextHelpfulCount = increment
          ? currentHelpfulCount + 1
          : Math.max(0, currentHelpfulCount - 1);

        const updatedReview = await prisma.review.update({
          where: { id },
          data: {
            helpfulCount: nextHelpfulCount,
          },
        });

        return {
          success: true,
          message: increment
            ? "Review marked helpful"
            : "Helpful mark removed",
          data: normalizeReview(updatedReview),
        };
      } catch (error) {
        console.error("GRAPHQL TOGGLE HELPFUL ERROR:", error);
        return {
          success: false,
          message: "Failed to update helpful count",
          data: null,
        };
      }
    },

    pinReview: async (_, { id }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        const pinnedCount = await prisma.review.count({
          where: {
            shop: existingReview.shop,
            productId: existingReview.productId,
            isPinned: true,
          },
        });

        if (!existingReview.isPinned && pinnedCount >= 3) {
          return {
            success: false,
            message: "You can pin maximum 3 reviews only for this product.",
            data: null,
          };
        }

        const updatedReview = await prisma.review.update({
          where: { id },
          data: {
            isPinned: true,
          },
        });

        return {
          success: true,
          message: "Review pinned successfully",
          data: normalizeReview(updatedReview),
        };
      } catch (error) {
        console.error("GRAPHQL PIN REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to pin review",
          data: null,
        };
      }
    },

    unpinReview: async (_, { id }) => {
      try {
        const existingReview = await prisma.review.findUnique({
          where: { id },
        });

        if (!existingReview) {
          return {
            success: false,
            message: "Review not found",
            data: null,
          };
        }

        const updatedReview = await prisma.review.update({
          where: { id },
          data: {
            isPinned: false,
          },
        });

        return {
          success: true,
          message: "Review unpinned successfully",
          data: normalizeReview(updatedReview),
        };
      } catch (error) {
        console.error("GRAPHQL UNPIN REVIEW ERROR:", error);
        return {
          success: false,
          message: "Failed to unpin review",
          data: null,
        };
      }
    },
  },
};

import { json } from "@remix-run/node";
import prisma from "../db.server";

function safeParseImages(value) {
  if (!value) return [];

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
  return {
    ...review,
    reviewImages: safeParseImages(review.reviewImages),
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

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);

    const productId = url.searchParams.get("productId");
    const shop = url.searchParams.get("shop");
    const approvedOnly = url.searchParams.get("approvedOnly") === "true";
    const onlyMedia = url.searchParams.get("onlyMedia") === "true";
    const reviewType = (url.searchParams.get("reviewType") || "any").trim();
    const starRatingParam = url.searchParams.get("starRating");
    const limitParam = url.searchParams.get("limit");

    const parsedStarRating = starRatingParam ? Number(starRatingParam) : null;
    const parsedLimit = limitParam ? Number(limitParam) : null;

    if (!productId && !shop) {
      return json(
        {
          success: false,
          message: "productId or shop is required",
          totalReviews: 0,
          averageRating: 0,
          data: [],
        },
        { status: 400 }
      );
    }

    const where = {};

    if (productId) {
      where.productId = String(productId);
    }

    if (shop) {
      where.shop = String(shop);
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    const normalizedReviews = reviews.map(normalizeReview);

    let filteredReviews = [...normalizedReviews];

    if (approvedOnly) {
      filteredReviews = filteredReviews.filter(
        (review) => review.status === "approved"
      );
    }

    if (
      parsedStarRating !== null &&
      !Number.isNaN(parsedStarRating) &&
      parsedStarRating >= 1 &&
      parsedStarRating <= 5
    ) {
      filteredReviews = filteredReviews.filter(
        (review) => Number(review.rating) === parsedStarRating
      );
    }

    if (reviewType === "uploaded") {
      filteredReviews = filteredReviews.filter((review) =>
        Boolean(review.reviewVideoUrl)
      );
    } else if (reviewType === "youtube") {
      filteredReviews = filteredReviews.filter((review) =>
        Boolean(review.reviewYoutubeUrl)
      );
    }

    if (onlyMedia) {
      filteredReviews = filteredReviews.filter(
        (review) =>
          Boolean(review.reviewVideoUrl) || Boolean(review.reviewYoutubeUrl)
      );
    }

    if (parsedLimit !== null && !Number.isNaN(parsedLimit) && parsedLimit > 0) {
      filteredReviews = filteredReviews.slice(0, parsedLimit);
    }

    const totalReviews = filteredReviews.length;
    const averageRating =
      totalReviews > 0
        ? filteredReviews.reduce(
            (sum, item) => sum + (Number(item.rating) || 0),
            0
          ) / totalReviews
        : 0;

    return json({
      success: true,
      message: "Reviews fetched successfully",
      totalReviews,
      averageRating: Number(averageRating.toFixed(1)),
      data: approvedOnly ? filteredReviews : normalizedReviews,
    });
  } catch (error) {
    console.error("STOREFRONT GET REVIEWS ERROR:", error);
    return json(
      {
        success: false,
        message: "Failed to fetch reviews",
        totalReviews: 0,
        averageRating: 0,
        data: [],
      },
      { status: 500 }
    );
  }
};

export const action = async ({ request }) => {
  try {
    if (request.method === "POST") {
      const body = await request.json();

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
      } = body;

      if (!shop || !productId || !customerName || !rating || !message) {
        return json(
          {
            success: false,
            message:
              "shop, productId, customerName, rating and message are required",
          },
          { status: 400 }
        );
      }

      const parsedRating = Number(rating);

      if (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return json(
          { success: false, message: "Rating must be between 1 and 5" },
          { status: 400 }
        );
      }

      let normalizedImages = [];

      if (Array.isArray(reviewImages)) {
        normalizedImages = reviewImages.filter(
          (item) => typeof item === "string" && item.trim() !== ""
        );
      }

      if (normalizedImages.length > 4) {
        return json(
          { success: false, message: "You can upload up to 4 images only" },
          { status: 400 }
        );
      }

      const normalizedVideoUrl = normalizeVideoUrl(reviewVideoUrl);
      const normalizedYoutubeUrl = normalizeYoutubeUrl(reviewYoutubeUrl);

      if (reviewYoutubeUrl && !normalizedYoutubeUrl) {
        return json(
          { success: false, message: "Please enter a valid YouTube link" },
          { status: 400 }
        );
      }

      const review = await prisma.review.create({
        data: {
          shop: String(shop),
          productId: String(productId),
          productTitle: productTitle || null,
          customerName: String(customerName).trim(),
          customerEmail: customerEmail ? String(customerEmail).trim() : null,
          rating: parsedRating,
          title: title ? String(title).trim() : null,
          message: String(message).trim(),
          reviewImages: normalizedImages.length
            ? JSON.stringify(normalizedImages)
            : null,
          reviewVideoUrl: normalizedVideoUrl,
          reviewYoutubeUrl: normalizedYoutubeUrl,
          helpfulCount: 0,
          status: "pending",
        },
      });

      return json({
        success: true,
        message: "Review submitted successfully",
        data: normalizeReview(review),
      });
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const { reviewId, increment } = body;

      if (!reviewId || typeof increment !== "boolean") {
        return json(
          {
            success: false,
            message: "reviewId and increment are required",
          },
          { status: 400 }
        );
      }

      const existingReview = await prisma.review.findUnique({
        where: { id: String(reviewId) },
      });

      if (!existingReview) {
        return json(
          { success: false, message: "Review not found" },
          { status: 404 }
        );
      }

      const currentHelpfulCount = Number(existingReview.helpfulCount || 0);
      const nextHelpfulCount = increment
        ? currentHelpfulCount + 1
        : Math.max(0, currentHelpfulCount - 1);

      const updatedReview = await prisma.review.update({
        where: { id: String(reviewId) },
        data: {
          helpfulCount: nextHelpfulCount,
        },
      });

      return json({
        success: true,
        message: increment ? "Marked helpful" : "Helpful removed",
        data: normalizeReview(updatedReview),
      });
    }

    return json(
      { success: false, message: "Method not allowed" },
      { status: 405 }
    );
  } catch (error) {
    console.error("STOREFRONT REVIEW ACTION ERROR:", error);
    return json(
      { success: false, message: "Request failed" },
      { status: 500 }
    );
  }
};

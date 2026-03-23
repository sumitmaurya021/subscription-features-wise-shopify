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

function normalizeReview(review) {
  return {
    ...review,
    reviewImages: safeParseImages(review.reviewImages),
    helpfulCount: Number(review.helpfulCount || 0),
    isPinned: Boolean(review.isPinned),
  };
}

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const shop = url.searchParams.get("shop");

    if (!productId) {
      return json(
        { success: false, message: "productId is required", data: [] },
        { status: 400 }
      );
    }

    const where = {
      productId: String(productId),
    };

    if (shop) where.shop = shop;

    const reviews = await prisma.review.findMany({
      where,
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
    });

    const normalizedReviews = reviews.map(normalizeReview);

    const approvedReviews = normalizedReviews.filter(
      (review) => review.status === "approved"
    );

    const totalReviews = approvedReviews.length;
    const averageRating =
      totalReviews > 0
        ? approvedReviews.reduce((sum, item) => sum + item.rating, 0) / totalReviews
        : 0;

    return json({
      success: true,
      totalReviews,
      averageRating: Number(averageRating.toFixed(1)),
      data: normalizedReviews,
    });
  } catch (error) {
    console.error("STOREFRONT GET REVIEWS ERROR:", error);
    return json(
      { success: false, message: "Failed to fetch reviews", data: [] },
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
      } = body;

      if (!shop || !productId || !customerName || !rating || !message) {
        return json(
          {
            success: false,
            message: "shop, productId, customerName, rating and message are required",
          },
          { status: 400 }
        );
      }

      const parsedRating = Number(rating);

      if (parsedRating < 1 || parsedRating > 5) {
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
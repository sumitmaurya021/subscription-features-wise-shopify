import { json } from "@remix-run/node";
import prisma from "../db.server";

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
      // status: "approved",
    };

    if (shop) where.shop = shop;

    const reviews = await prisma.review.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, item) => sum + item.rating, 0) / totalReviews
        : 0;

    return json({
      success: true,
      totalReviews,
      averageRating: Number(averageRating.toFixed(1)),
      data: reviews,
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
    if (request.method !== "POST") {
      return json(
        { success: false, message: "Method not allowed" },
        { status: 405 }
      );
    }

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
        status: "pending",
      },
    });

    return json({
      success: true,
      message: "Review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.error("STOREFRONT CREATE REVIEW ERROR:", error);
    return json(
      { success: false, message: "Failed to submit review" },
      { status: 500 }
    );
  }
};

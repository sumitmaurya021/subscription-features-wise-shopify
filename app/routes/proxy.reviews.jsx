import { json } from "@remix-run/node";
import prisma from "../db.server";

const MAX_REVIEW_IMAGES = 4;

function safeParseImages(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim() !== "");
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim() !== "")
      : [];
  } catch {
    return [];
  }
}

function normalizeYoutubeUrl(value) {
  if (!value) return null;

  const url = String(value).trim();
  if (!url) return null;

  try {
    if (url.includes("/embed/")) {
      const embedUrl = new URL(url);
      const videoId = embedUrl.pathname.split("/embed/")[1]?.split("/")[0] || "";
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

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

      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
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

function normalizeReviewType(value) {
  const reviewType = String(value || "product").trim().toLowerCase();

  if (["product", "collection", "store"].includes(reviewType)) {
    return reviewType;
  }

  return "product";
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;

  const parsed = String(value).trim();
  return parsed || null;
}

function parseCsvIds(value) {
  return String(value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferReviewType({
  explicitReviewType,
  productId,
  productIds,
  targetId,
  targetIds,
  targetHandle,
  collectionId,
  collectionHandle,
  shop,
}) {
  if (explicitReviewType) {
    return normalizeReviewType(explicitReviewType);
  }

  if (productId || (Array.isArray(productIds) && productIds.length > 0)) {
    return "product";
  }

  if (targetHandle || collectionHandle) {
    return "collection";
  }

  if (
    targetId ||
    collectionId ||
    (Array.isArray(targetIds) && targetIds.length > 0)
  ) {
    return "product";
  }

  if (shop) {
    return "store";
  }

  return "product";
}

function buildReviewTargetFields(input = {}, existingReview = null) {
  const nextReviewType = normalizeReviewType(
    input.reviewType ??
      existingReview?.reviewType ??
      inferReviewType({
        explicitReviewType: input.reviewType,
        productId: input.productId,
        productIds: input.productIds,
        targetId: input.targetId,
        targetIds: input.targetIds,
        targetHandle: input.targetHandle,
        collectionId: input.collectionId,
        collectionHandle: input.collectionHandle,
        shop: input.shop ?? existingReview?.shop,
      })
  );

  const resolvedTargetId =
    normalizeNullableString(input.targetId) ??
    normalizeNullableString(input.productId) ??
    normalizeNullableString(input.collectionId) ??
    normalizeNullableString(existingReview?.targetId) ??
    normalizeNullableString(existingReview?.productId);

  const resolvedTargetHandle =
    normalizeNullableString(input.targetHandle) ??
    normalizeNullableString(input.collectionHandle) ??
    normalizeNullableString(existingReview?.targetHandle);

  const resolvedTargetTitle =
    normalizeNullableString(input.targetTitle) ??
    normalizeNullableString(input.productTitle) ??
    normalizeNullableString(input.collectionTitle) ??
    normalizeNullableString(input.storeTitle) ??
    normalizeNullableString(existingReview?.targetTitle) ??
    normalizeNullableString(existingReview?.productTitle);

  let targetId = resolvedTargetId;
  let targetHandle = resolvedTargetHandle;
  let targetTitle = resolvedTargetTitle;

  let productId = null;
  let productTitle = null;

  if (nextReviewType === "product") {
    productId = resolvedTargetId;
    productTitle = resolvedTargetTitle;
  }

  if (nextReviewType === "collection") {
    productId = null;
    productTitle = null;
  }

  if (nextReviewType === "store") {
    targetId = null;
    targetHandle = null;
    productId = null;
    productTitle = null;
    targetTitle =
      targetTitle ||
      normalizeNullableString(input.shop) ||
      normalizeNullableString(existingReview?.shop);
  }

  return {
    reviewType: nextReviewType,
    targetId,
    targetHandle,
    targetTitle,
    productId,
    productTitle,
  };
}

function validateReviewTarget({ reviewType, targetId, targetHandle, shop }) {
  if (reviewType === "product") {
    if (!targetId) {
      return "For product reviews, productId or targetId is required";
    }
    return null;
  }

  if (reviewType === "collection") {
    if (!targetId && !targetHandle) {
      return "For collection reviews, targetId or targetHandle is required";
    }
    return null;
  }

  if (reviewType === "store") {
    if (!shop) {
      return "Shop is required for store reviews";
    }
    return null;
  }

  return "Invalid review target";
}

function normalizeReview(review) {
  if (!review) return null;

  const reviewType = normalizeReviewType(review.reviewType || "product");

  const targetId =
    review.targetId !== undefined && review.targetId !== null
      ? String(review.targetId)
      : review.productId
      ? String(review.productId)
      : null;

  const targetTitle =
    review.targetTitle ||
    review.productTitle ||
    (reviewType === "store" ? review.shop : null) ||
    null;

  return {
    ...review,
    reviewType,
    targetId,
    targetHandle: review.targetHandle || null,
    targetTitle,
    productId: review.productId ? String(review.productId) : null,
    productTitle: review.productTitle || review.targetTitle || null,
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

function buildLoaderWhere({
  reviewType,
  shop,
  productId,
  productIds,
  targetId,
  targetIds,
  targetHandle,
  approvedOnly,
  featuredOnly,
  parsedStarRating,
  parsedMinRating,
}) {
  const where = {};

  if (shop) {
    where.shop = String(shop);
  }

  if (approvedOnly) {
    where.status = "approved";
  }

  if (featuredOnly) {
    where.isPinned = true;
  }

  if (
    parsedStarRating !== null &&
    !Number.isNaN(parsedStarRating) &&
    parsedStarRating >= 1 &&
    parsedStarRating <= 5
  ) {
    where.rating = parsedStarRating;
  } else if (
    parsedMinRating !== null &&
    !Number.isNaN(parsedMinRating) &&
    parsedMinRating >= 1 &&
    parsedMinRating <= 5
  ) {
    where.rating = { gte: parsedMinRating };
  }

  if (reviewType === "product") {
    where.reviewType = "product";

    const allIds = [
      ...productIds.map((id) => String(id)),
      ...targetIds.map((id) => String(id)),
    ];

    const singleId =
      normalizeNullableString(productId) ?? normalizeNullableString(targetId);

    if (allIds.length > 0) {
      where.OR = [{ targetId: { in: allIds } }, { productId: { in: allIds } }];
    } else if (singleId) {
      where.OR = [{ targetId: singleId }, { productId: singleId }];
    }
  } else if (reviewType === "collection") {
    where.reviewType = "collection";

    const normalizedTargetId = normalizeNullableString(targetId);
    const normalizedTargetHandle = normalizeNullableString(targetHandle);
    const allTargetIds = targetIds.map((id) => String(id));

    const orConditions = [];

    if (allTargetIds.length > 0) {
      orConditions.push({ targetId: { in: allTargetIds } });
    }

    if (normalizedTargetId) {
      orConditions.push({ targetId: normalizedTargetId });
    }

    if (normalizedTargetHandle) {
      orConditions.push({ targetHandle: normalizedTargetHandle });
    }

    if (orConditions.length === 1) {
      Object.assign(where, orConditions[0]);
    } else if (orConditions.length > 1) {
      where.OR = orConditions;
    }
  } else if (reviewType === "store") {
    where.reviewType = "store";
  }

  return where;
}

function sortNormalizedReviews(reviews, sort) {
  const items = [...reviews];
  const normalizedSort = String(sort || "default").trim().toLowerCase();

  const getTime = (value) => {
    if (!value) return 0;
    const raw = /^\d+$/.test(String(value)) ? Number(value) : value;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  if (normalizedSort === "oldest") {
    items.sort((a, b) => {
      if (Boolean(b.isPinned) !== Boolean(a.isPinned)) {
        return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      }
      return getTime(a.createdAt) - getTime(b.createdAt);
    });
    return items;
  }

  if (normalizedSort === "highest_rating") {
    items.sort((a, b) => {
      if (Boolean(b.isPinned) !== Boolean(a.isPinned)) {
        return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      }
      if (Number(b.rating || 0) !== Number(a.rating || 0)) {
        return Number(b.rating || 0) - Number(a.rating || 0);
      }
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
    return items;
  }

  if (normalizedSort === "lowest_rating") {
    items.sort((a, b) => {
      if (Boolean(b.isPinned) !== Boolean(a.isPinned)) {
        return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      }
      if (Number(a.rating || 0) !== Number(b.rating || 0)) {
        return Number(a.rating || 0) - Number(b.rating || 0);
      }
      return getTime(b.createdAt) - getTime(a.createdAt);
    });
    return items;
  }

  items.sort((a, b) => {
    if (Boolean(b.isPinned) !== Boolean(a.isPinned)) {
      return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    }
    return getTime(b.createdAt) - getTime(a.createdAt);
  });

  return items;
}

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);

    const productId = url.searchParams.get("productId");
    const productIdsParam = url.searchParams.get("productIds");

    const targetId = url.searchParams.get("targetId");
    const targetIdsParam = url.searchParams.get("targetIds");
    const targetHandle = url.searchParams.get("targetHandle");

    const collectionId = url.searchParams.get("collectionId");
    const collectionHandle = url.searchParams.get("collectionHandle");

    const shop = url.searchParams.get("shop");
    const explicitReviewType = url.searchParams.get("reviewType");

    const approvedOnly = url.searchParams.get("approvedOnly") === "true";
    const onlyMedia = url.searchParams.get("onlyMedia") === "true";
    const featuredOnly = url.searchParams.get("featuredOnly") === "true";

    const mediaType = (url.searchParams.get("reviewTypeMedia") || "").trim();
    const reviewTypeFilter = (url.searchParams.get("reviewTypeFilter") || "").trim();
    const sort = (url.searchParams.get("sort") || "default").trim();

    const starRatingParam = url.searchParams.get("starRating");
    const minRatingParam = url.searchParams.get("minRating");
    const limitParam = url.searchParams.get("limit");
    const pageParam = url.searchParams.get("page");

    const productIds = parseCsvIds(productIdsParam);
    const targetIds = parseCsvIds(targetIdsParam);

    if (collectionId) {
      targetIds.push(String(collectionId));
    }

    const parsedStarRating = starRatingParam ? Number(starRatingParam) : null;
    const parsedMinRating = minRatingParam ? Number(minRatingParam) : null;
    const parsedLimit = limitParam ? Number(limitParam) : null;
    const parsedPage = Math.max(1, Number(pageParam) || 1);

    const reviewType = inferReviewType({
      explicitReviewType,
      productId,
      productIds,
      targetId,
      targetIds,
      targetHandle,
      collectionId,
      collectionHandle,
      shop,
    });

    if (reviewType === "product") {
      const hasProductScope =
        Boolean(productId) ||
        productIds.length > 0 ||
        Boolean(targetId) ||
        targetIds.length > 0;

      if (!hasProductScope) {
        return json(
          {
            success: false,
            message:
              "For product reviews, productId, productIds, targetId, or targetIds is required",
            totalReviews: 0,
            averageRating: 0,
            data: [],
          },
          { status: 400 }
        );
      }
    }

    if (reviewType === "collection") {
      if (!targetId && !targetIds.length && !targetHandle && !collectionHandle) {
        return json(
          {
            success: false,
            message:
              "targetId, targetIds, targetHandle, or collectionHandle is required for collection reviews",
            totalReviews: 0,
            averageRating: 0,
            data: [],
          },
          { status: 400 }
        );
      }
    }

    if (reviewType === "store" && !shop) {
      return json(
        {
          success: false,
          message: "shop is required for store reviews",
          totalReviews: 0,
          averageRating: 0,
          data: [],
        },
        { status: 400 }
      );
    }

    const where = buildLoaderWhere({
      reviewType,
      shop,
      productId,
      productIds,
      targetId,
      targetIds,
      targetHandle: targetHandle || collectionHandle,
      approvedOnly,
      featuredOnly,
      parsedStarRating,
      parsedMinRating,
    });

    const reviews = await prisma.review.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    let filteredReviews = reviews.map(normalizeReview);

    if (reviewTypeFilter) {
      const normalizedTypeFilter = normalizeReviewType(reviewTypeFilter);
      filteredReviews = filteredReviews.filter(
        (review) => review.reviewType === normalizedTypeFilter
      );
    }

    if (mediaType === "uploaded") {
      filteredReviews = filteredReviews.filter((review) =>
        Boolean(review.reviewVideoUrl)
      );
    } else if (mediaType === "youtube") {
      filteredReviews = filteredReviews.filter((review) =>
        Boolean(review.reviewYoutubeUrl)
      );
    }

    if (onlyMedia) {
      filteredReviews = filteredReviews.filter(
        (review) =>
          (Array.isArray(review.reviewImages) && review.reviewImages.length > 0) ||
          Boolean(review.reviewVideoUrl) ||
          Boolean(review.reviewYoutubeUrl)
      );
    }

    filteredReviews = sortNormalizedReviews(filteredReviews, sort);

    const totalReviews = filteredReviews.length;
    const averageRating =
      totalReviews > 0
        ? filteredReviews.reduce(
            (sum, item) => sum + (Number(item.rating) || 0),
            0
          ) / totalReviews
        : 0;

    let paginatedReviews = filteredReviews;

    if (parsedLimit !== null && !Number.isNaN(parsedLimit) && parsedLimit > 0) {
      const start = (parsedPage - 1) * parsedLimit;
      paginatedReviews = filteredReviews.slice(start, start + parsedLimit);
    }

    return json(
      {
        success: true,
        message: "Reviews fetched successfully",
        totalReviews,
        averageRating: Number(averageRating.toFixed(2)),
        data: paginatedReviews,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
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
        customerName,
        customerEmail,
        rating,
        title,
        message,
        reviewImages,
        reviewVideoUrl,
        reviewYoutubeUrl,
      } = body;

      if (!shop || !customerName || !rating || !message) {
        return json(
          {
            success: false,
            message: "shop, customerName, rating and message are required",
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

      if (normalizedImages.length > MAX_REVIEW_IMAGES) {
        return json(
          {
            success: false,
            message: `You can upload up to ${MAX_REVIEW_IMAGES} images only`,
          },
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

      const targetFields = buildReviewTargetFields(body);

      const targetValidationError = validateReviewTarget({
        reviewType: targetFields.reviewType,
        targetId: targetFields.targetId,
        targetHandle: targetFields.targetHandle,
        shop,
      });

      if (targetValidationError) {
        return json(
          {
            success: false,
            message: targetValidationError,
          },
          { status: 400 }
        );
      }

      const review = await prisma.review.create({
        data: {
          shop: String(shop).trim(),

          reviewType: targetFields.reviewType,
          targetId: targetFields.targetId,
          targetHandle: targetFields.targetHandle,
          targetTitle: targetFields.targetTitle,

          productId: targetFields.productId,
          productTitle: targetFields.productTitle,

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
          isPinned: false,
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

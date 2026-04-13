import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Modal,
  TextField,
  Select,
  EmptyState,
  Spinner,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";

const GRAPHQL_ENDPOINT = "/graphql";
const PAGE_SIZE = 10;

const GET_REVIEWS_QUERY = `
  query GetReviews(
    $shop: String
    $status: String
    $productId: String
    $reviewType: String
    $targetId: String
    $targetHandle: String
  ) {
    reviews(
      shop: $shop
      status: $status
      productId: $productId
      reviewType: $reviewType
      targetId: $targetId
      targetHandle: $targetHandle
    ) {
      success
      message
      count
      data {
        id
        shop
        reviewType
        targetId
        targetHandle
        targetTitle
        productId
        productTitle
        customerName
        customerEmail
        rating
        title
        message
        reviewImages
        reviewVideoUrl
        reviewYoutubeUrl
        helpfulCount
        status
        isPinned
        createdAt
        updatedAt
      }
    }
  }
`;

const CREATE_REVIEW_MUTATION = `
  mutation CreateReview($input: CreateReviewInput!) {
    createReview(input: $input) {
      success
      message
      data {
        id
        shop
        reviewType
        targetId
        targetHandle
        targetTitle
        productId
        productTitle
        customerName
        customerEmail
        rating
        title
        message
        reviewImages
        reviewVideoUrl
        reviewYoutubeUrl
        helpfulCount
        status
        isPinned
        createdAt
        updatedAt
      }
    }
  }
`;

const UPDATE_REVIEW_MUTATION = `
  mutation UpdateReview($id: ID!, $input: UpdateReviewInput!) {
    updateReview(id: $id, input: $input) {
      success
      message
      data {
        id
        shop
        reviewType
        targetId
        targetHandle
        targetTitle
        productId
        productTitle
        customerName
        customerEmail
        rating
        title
        message
        reviewImages
        reviewVideoUrl
        reviewYoutubeUrl
        helpfulCount
        status
        isPinned
        createdAt
        updatedAt
      }
    }
  }
`;

const DELETE_REVIEW_MUTATION = `
  mutation DeleteReview($id: ID!) {
    deleteReview(id: $id) {
      success
      message
      data {
        id
      }
    }
  }
`;

const APPROVE_REVIEW_MUTATION = `
  mutation ApproveReview($id: ID!) {
    approveReview(id: $id) {
      success
      message
      data {
        id
        status
      }
    }
  }
`;

const REJECT_REVIEW_MUTATION = `
  mutation RejectReview($id: ID!) {
    rejectReview(id: $id) {
      success
      message
      data {
        id
        status
      }
    }
  }
`;

const PIN_REVIEW_MUTATION = `
  mutation PinReview($id: ID!) {
    pinReview(id: $id) {
      success
      message
      data {
        id
        isPinned
      }
    }
  }
`;

const UNPIN_REVIEW_MUTATION = `
  mutation UnpinReview($id: ID!) {
    unpinReview(id: $id) {
      success
      message
      data {
        id
        isPinned
      }
    }
  }
`;

const initialFilterState = {
  status: "",
  reviewType: "",
  shop: "",
  productId: "",
  targetId: "",
  targetHandle: "",
};

const initialFormState = {
  id: null,
  shop: "",
  reviewType: "product",
  targetId: "",
  targetHandle: "",
  targetTitle: "",
  productId: "",
  productTitle: "",
  customerName: "",
  customerEmail: "",
  rating: "5",
  title: "",
  message: "",
  reviewVideoUrl: "",
  reviewYoutubeUrl: "",
  status: "pending",
  isPinned: "false",
};

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors[0].message || "GraphQL request failed");
  }

  return result.data;
}

function normalizeReviewType(value) {
  const reviewType = String(value || "product").trim().toLowerCase();
  if (["product", "collection", "store"].includes(reviewType)) return reviewType;
  return "product";
}

function getBadgeTone(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "critical";
  return "attention";
}

function getStatusOptions() {
  return [
    { label: "All", value: "" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];
}

function getReviewTypeOptions(includeAll = false) {
  const base = [
    { label: "Product", value: "product" },
    { label: "Collection", value: "collection" },
    { label: "Store", value: "store" },
  ];

  if (includeAll) return [{ label: "All", value: "" }, ...base];
  return base;
}

function getRatingOptions() {
  return [
    { label: "1 Star", value: "1" },
    { label: "2 Stars", value: "2" },
    { label: "3 Stars", value: "3" },
    { label: "4 Stars", value: "4" },
    { label: "5 Stars", value: "5" },
  ];
}

function getReviewTypeShortLabel(reviewType) {
  const normalized = normalizeReviewType(reviewType);
  if (normalized === "collection") return "Collection";
  if (normalized === "store") return "Store";
  return "Product";
}

function getReviewTypeTone(reviewType) {
  const normalized = normalizeReviewType(reviewType);
  if (normalized === "collection") return "attention";
  if (normalized === "store") return "info";
  return "success";
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(Number(dateValue) || dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderStars(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating || 0)));
  return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
}

function getStatusStyles(status) {
  if (status === "approved") {
    return {
      color: "#065f46",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
      dot: "#10b981",
    };
  }

  if (status === "rejected") {
    return {
      color: "#991b1b",
      background: "#fef2f2",
      border: "1px solid #fecaca",
      dot: "#ef4444",
    };
  }

  return {
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    dot: "#f59e0b",
  };
}

function getYoutubeEmbedUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(String(url).trim());

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

function getReviewTargetSummary(review) {
  const reviewType = normalizeReviewType(review.reviewType);
  const targetTitle =
    review.targetTitle ||
    review.productTitle ||
    (reviewType === "store" ? review.shop : "");

  if (reviewType === "product") {
    return {
      title: targetTitle || "Untitled Product",
      subText: `Product ID: ${review.targetId || review.productId || "-"}`,
    };
  }

  if (reviewType === "collection") {
    return {
      title: targetTitle || "Untitled Collection",
      subText: `Collection ID: ${review.targetId || "-"}${
        review.targetHandle ? ` · Handle: ${review.targetHandle}` : ""
      }`,
    };
  }

  return {
    title: targetTitle || review.shop || "Store",
    subText: `Shop: ${review.shop || "-"}`,
  };
}

function getReviewImages(reviewImages) {
  if (Array.isArray(reviewImages)) return reviewImages.filter(Boolean);

  if (typeof reviewImages === "string") {
    try {
      const parsed = JSON.parse(reviewImages);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return reviewImages ? [reviewImages] : [];
    } catch {
      return reviewImages ? [reviewImages] : [];
    }
  }

  return [];
}

function getMediaCount(review) {
  const images = getReviewImages(review.reviewImages);
  return (
    images.length +
    (review.reviewVideoUrl ? 1 : 0) +
    (review.reviewYoutubeUrl ? 1 : 0)
  );
}

function hasMedia(review) {
  return getMediaCount(review) > 0;
}

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

function StatusPill({ status }) {
  const styles = getStatusStyles(status);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: styles.background,
        border: styles.border,
        color: styles.color,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "capitalize",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: styles.dot,
          display: "inline-block",
        }}
      />
      {status || "pending"}
    </div>
  );
}

function PremiumStatCard({
  title,
  value,
  helper,
  accent = "blue",
  softLabel,
}) {
  const accentMap = {
    blue: {
      top: "linear-gradient(135deg, #eef4ff 0%, #f8fbff 100%)",
      glow: "rgba(59, 130, 246, 0.16)",
      line: "#3b82f6",
      chipBg: "#eff6ff",
      chipText: "#1d4ed8",
    },
    green: {
      top: "linear-gradient(135deg, #ecfdf3 0%, #f7fef9 100%)",
      glow: "rgba(16, 185, 129, 0.16)",
      line: "#10b981",
      chipBg: "#ecfdf5",
      chipText: "#047857",
    },
    amber: {
      top: "linear-gradient(135deg, #fff7e8 0%, #fffdfa 100%)",
      glow: "rgba(245, 158, 11, 0.16)",
      line: "#f59e0b",
      chipBg: "#fffbeb",
      chipText: "#b45309",
    },
    red: {
      top: "linear-gradient(135deg, #fef2f2 0%, #fff8f8 100%)",
      glow: "rgba(239, 68, 68, 0.16)",
      line: "#ef4444",
      chipBg: "#fef2f2",
      chipText: "#b91c1c",
    },
    violet: {
      top: "linear-gradient(135deg, #f5f3ff 0%, #fbfaff 100%)",
      glow: "rgba(139, 92, 246, 0.16)",
      line: "#8b5cf6",
      chipBg: "#f5f3ff",
      chipText: "#6d28d9",
    },
    slate: {
      top: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
      glow: "rgba(71, 85, 105, 0.12)",
      line: "#64748b",
      chipBg: "#f1f5f9",
      chipText: "#334155",
    },
  };

  const palette = accentMap[accent] || accentMap.blue;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        border: "1px solid rgba(226, 232, 240, 0.95)",
        background: palette.top,
        boxShadow: `0 10px 30px ${palette.glow}, 0 2px 6px rgba(15, 23, 42, 0.04)`,
        padding: 18,
        minHeight: 128,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: palette.line,
        }}
      />

      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="start">
          <Text as="span" variant="bodySm" tone="subdued">
            {title}
          </Text>

          {softLabel ? (
            <span
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                background: palette.chipBg,
                color: palette.chipText,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {softLabel}
            </span>
          ) : null}
        </InlineStack>

        <div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            {value}
          </div>

          {helper ? (
            <div
              style={{
                marginTop: 8,
                color: "#64748b",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {helper}
            </div>
          ) : null}
        </div>
      </BlockStack>
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const [filters, setFilters] = useState(initialFilterState);
  const [appliedFilters, setAppliedFilters] = useState(initialFilterState);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [approveLoadingId, setApproveLoadingId] = useState(null);
  const [rejectLoadingId, setRejectLoadingId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pinLoadingId, setPinLoadingId] = useState(null);

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [selectedMediaReview, setSelectedMediaReview] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState(initialFormState);

  const isEditMode = Boolean(formData.id);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const data = await graphqlRequest(GET_REVIEWS_QUERY, {
        shop: appliedFilters.shop || null,
        status: appliedFilters.status || null,
        productId: appliedFilters.productId || null,
        reviewType: appliedFilters.reviewType || null,
        targetId: appliedFilters.targetId || null,
        targetHandle: appliedFilters.targetHandle || null,
      });

      setReviews(data.reviews?.data || []);
    } catch (error) {
      setPageError(error.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const pending = reviews.filter((r) => r.status === "pending").length;
    const rejected = reviews.filter((r) => r.status === "rejected").length;
    const pinned = reviews.filter((r) => Boolean(r.isPinned)).length;

    const productReviews = reviews.filter(
      (r) => normalizeReviewType(r.reviewType) === "product"
    ).length;
    const collectionReviews = reviews.filter(
      (r) => normalizeReviewType(r.reviewType) === "collection"
    ).length;
    const storeReviews = reviews.filter(
      (r) => normalizeReviewType(r.reviewType) === "store"
    ).length;

    const average =
      total > 0
        ? (
            reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / total
          ).toFixed(1)
        : "0.0";

    return {
      total,
      approved,
      pending,
      rejected,
      pinned,
      average,
      productReviews,
      collectionReviews,
      storeReviews,
    };
  }, [reviews]);

  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedReviews = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return reviews.slice(start, start + PAGE_SIZE);
  }, [reviews, safeCurrentPage]);

  const startItem = reviews.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safeCurrentPage * PAGE_SIZE, reviews.length);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeFilterCount = useMemo(() => {
    return Object.values(appliedFilters).filter(Boolean).length;
  }, [appliedFilters]);

  const resetForm = () => {
    setFormData(initialFormState);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (review) => {
    const reviewType = normalizeReviewType(review.reviewType);

    setFormData({
      id: review.id,
      shop: review.shop || "",
      reviewType,
      targetId: review.targetId || review.productId || "",
      targetHandle: review.targetHandle || "",
      targetTitle: review.targetTitle || review.productTitle || "",
      productId: review.productId || "",
      productTitle: review.productTitle || "",
      customerName: review.customerName || "",
      customerEmail: review.customerEmail || "",
      rating: String(review.rating || "5"),
      title: review.title || "",
      message: review.message || "",
      reviewVideoUrl: review.reviewVideoUrl || "",
      reviewYoutubeUrl: review.reviewYoutubeUrl || "",
      status: review.status || "pending",
      isPinned: String(Boolean(review.isPinned)),
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const openMediaModal = (review) => {
    setSelectedMediaReview(review);
    setMediaModalOpen(true);
  };

  const closeMediaModal = () => {
    setMediaModalOpen(false);
    setSelectedMediaReview(null);
  };

  const handleFieldChange = (field) => (value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "reviewType") {
        const nextType = normalizeReviewType(value);

        if (nextType === "store") {
          next.targetId = "";
          next.targetHandle = "";
          next.productId = "";
          next.productTitle = "";
        }

        if (nextType === "collection") {
          next.productId = "";
          next.productTitle = "";
        }

        if (nextType === "product") {
          next.targetHandle = "";
        }
      }

      return next;
    });
  };

  const handleFilterChange = (field) => (value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(initialFilterState);
    setAppliedFilters(initialFilterState);
    setCurrentPage(1);
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setPageError("");
      setPageMessage("");

      const reviewType = normalizeReviewType(formData.reviewType);
      const cleanShop = formData.shop.trim();
      const cleanTargetId = formData.targetId.trim();
      const cleanTargetHandle = formData.targetHandle.trim();
      const cleanTargetTitle = formData.targetTitle.trim();
      const cleanCustomerName = formData.customerName.trim();
      const cleanCustomerEmail = formData.customerEmail.trim();
      const cleanTitle = formData.title.trim();
      const cleanMessage = formData.message.trim();
      const cleanReviewVideoUrl = formData.reviewVideoUrl.trim();
      const cleanReviewYoutubeUrl = formData.reviewYoutubeUrl.trim();

      if (!cleanShop || !cleanCustomerName || !formData.rating || !cleanMessage) {
        setPageError("Shop, Customer name, Rating, and Message are required.");
        return;
      }

      if (reviewType === "product" && !cleanTargetId) {
        setPageError("Product review ke liye Target ID / Product ID required hai.");
        return;
      }

      if (reviewType === "collection" && !cleanTargetId && !cleanTargetHandle) {
        setPageError("Collection review ke liye Target ID ya Target Handle required hai.");
        return;
      }

      if (cleanReviewYoutubeUrl && !getYoutubeEmbedUrl(cleanReviewYoutubeUrl)) {
        setPageError("Please enter a valid YouTube link.");
        return;
      }

      const sharedInput = {
        reviewType,
        targetId: cleanTargetId || null,
        targetHandle: cleanTargetHandle || null,
        targetTitle: cleanTargetTitle || null,
        customerName: cleanCustomerName,
        customerEmail: cleanCustomerEmail || null,
        rating: Number(formData.rating),
        title: cleanTitle || null,
        message: cleanMessage,
        reviewVideoUrl: cleanReviewVideoUrl || null,
        reviewYoutubeUrl: cleanReviewYoutubeUrl || null,
      };

      if (isEditMode) {
        const data = await graphqlRequest(UPDATE_REVIEW_MUTATION, {
          id: formData.id,
          input: {
            ...sharedInput,
            productId: reviewType === "product" ? cleanTargetId || null : null,
            productTitle: reviewType === "product" ? cleanTargetTitle || null : null,
            status: formData.status,
            isPinned: formData.isPinned === "true",
          },
        });

        if (!data.updateReview.success) {
          throw new Error(data.updateReview.message || "Failed to update review");
        }

        setPageMessage("Review updated successfully.");
      } else {
        const data = await graphqlRequest(CREATE_REVIEW_MUTATION, {
          input: {
            shop: cleanShop,
            ...sharedInput,
            productId: reviewType === "product" ? cleanTargetId || null : null,
            productTitle: reviewType === "product" ? cleanTargetTitle || null : null,
          },
        });

        if (!data.createReview.success) {
          throw new Error(data.createReview.message || "Failed to create review");
        }

        setPageMessage("Review created successfully.");
      }

      closeModal();
      await fetchReviews();
    } catch (error) {
      setPageError(error.message || "Save failed");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setApproveLoadingId(id);
      setPageError("");
      setPageMessage("");

      const data = await graphqlRequest(APPROVE_REVIEW_MUTATION, { id });

      if (!data.approveReview.success) {
        throw new Error(data.approveReview.message || "Failed to approve review");
      }

      setPageMessage("Review approved successfully.");
      await fetchReviews();
    } catch (error) {
      setPageError(error.message || "Approve failed");
    } finally {
      setApproveLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setRejectLoadingId(id);
      setPageError("");
      setPageMessage("");

      const data = await graphqlRequest(REJECT_REVIEW_MUTATION, { id });

      if (!data.rejectReview.success) {
        throw new Error(data.rejectReview.message || "Failed to reject review");
      }

      setPageMessage("Review rejected successfully.");
      await fetchReviews();
    } catch (error) {
      setPageError(error.message || "Reject failed");
    } finally {
      setRejectLoadingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeleteLoadingId(id);
      setPageError("");
      setPageMessage("");

      const data = await graphqlRequest(DELETE_REVIEW_MUTATION, { id });

      if (!data.deleteReview.success) {
        throw new Error(data.deleteReview.message || "Failed to delete review");
      }

      setPageMessage("Review deleted successfully.");
      await fetchReviews();
    } catch (error) {
      setPageError(error.message || "Delete failed");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handlePin = async (id) => {
    try {
      setPinLoadingId(id);
      setPageError("");
      setPageMessage("");

      const data = await graphqlRequest(PIN_REVIEW_MUTATION, { id });

      if (!data.pinReview.success) {
        throw new Error(data.pinReview.message || "Failed to pin review");
      }

      setPageMessage("Review pinned successfully.");
      await fetchReviews();
    } catch (error) {
      setPageError(error.message || "Pin failed");
    } finally {
      setPinLoadingId(null);
    }
  };

  const handleUnpin = async (id) => {
    try {
      setPinLoadingId(id);
      setPageError("");
      setPageMessage("");

      const data = await graphqlRequest(UNPIN_REVIEW_MUTATION, { id });

      if (!data.unpinReview.success) {
        throw new Error(data.unpinReview.message || "Failed to unpin review");
      }

      setPageMessage("Review unpinned successfully.");
      await fetchReviews();
    } catch (error) {
      setPageError(error.message || "Unpin failed");
    } finally {
      setPinLoadingId(null);
    }
  };

  const currentReviewType = normalizeReviewType(formData.reviewType);
  const selectedImages = getReviewImages(selectedMediaReview?.reviewImages);
  const selectedYoutubeEmbedUrl = getYoutubeEmbedUrl(selectedMediaReview?.reviewYoutubeUrl);
  const visiblePages = getVisiblePages(safeCurrentPage, totalPages);

  return (
    <Page
      title="Reviews Management"
      subtitle="Premium moderation dashboard for product, collection, and store reviews."
      primaryAction={{ content: "Create review", onAction: openCreateModal }}
    >
      <style>
        {`
          .dashboard-shell {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .hero-surface {
            position: relative;
            overflow: hidden;
            border-radius: 24px;
            padding: 24px;
            background:
              radial-gradient(circle at top right, rgba(59,130,246,0.16), transparent 28%),
              radial-gradient(circle at left bottom, rgba(139,92,246,0.12), transparent 30%),
              linear-gradient(135deg, #ffffff 0%, #f8fbff 55%, #f8fafc 100%);
            border: 1px solid rgba(226, 232, 240, 0.95);
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
          }

          .hero-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            border-radius: 999px;
            background: rgba(255,255,255,0.78);
            border: 1px solid rgba(226,232,240,0.95);
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
            font-size: 12px;
            font-weight: 700;
            color: #334155;
          }

          .hero-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          }

          .premium-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 14px;
          }

          .premium-filter-panel {
            position: relative;
            overflow: hidden;
            border-radius: 24px;
            border: 1px solid rgba(226, 232, 240, 0.95);
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 24%),
              linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
            padding: 22px;
          }

          .premium-filter-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 16px;
          }

          .filter-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
          }

          .premium-input-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 14px;
          }

          .field-shell {
            padding: 12px;
            border-radius: 18px;
            background: rgba(255,255,255,0.86);
            border: 1px solid #e2e8f0;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 6px 18px rgba(15, 23, 42, 0.03);
            transition: all 0.2s ease;
          }

          .field-shell:hover {
            border-color: #cbd5e1;
            transform: translateY(-1px);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 24px rgba(15, 23, 42, 0.05);
          }

          .premium-filter-panel .Polaris-Labelled__LabelWrapper {
            margin-bottom: 8px;
          }

          .premium-filter-panel .Polaris-Label__Text {
            font-size: 12px;
            font-weight: 700;
            color: #334155;
          }

          .premium-filter-panel .Polaris-TextField,
          .premium-filter-panel .Polaris-Select__Content {
            border-radius: 14px !important;
          }

          .premium-filter-panel .Polaris-TextField__Input,
          .premium-filter-panel .Polaris-Select__Input {
            background: #ffffff !important;
          }

          .reviews-table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          .reviews-table {
            width: 100%;
            min-width: 1280px;
            border-collapse: separate;
            border-spacing: 0;
          }

          .reviews-table thead th {
            position: sticky;
            top: 0;
            z-index: 1;
            background: #f8fafc;
            color: #475467;
            font-size: 12px;
            font-weight: 700;
            text-align: left;
            padding: 14px 16px;
            border-bottom: 1px solid #e5e7eb;
            white-space: nowrap;
          }

          .reviews-table tbody td {
            padding: 16px;
            vertical-align: top;
            border-bottom: 1px solid #eef2f7;
            background: #ffffff;
          }

          .reviews-table tbody tr:hover td {
            background: #fcfcfd;
          }

          .table-title {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
            line-height: 1.4;
            margin-bottom: 4px;
          }

          .table-subtext {
            font-size: 12px;
            color: #6b7280;
            line-height: 1.5;
            word-break: break-word;
          }

          .review-message-preview {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .media-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px;
          }

          .media-card {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            overflow: hidden;
            background: #ffffff;
            animation: mediaCardIn 260ms ease both;
          }

          .media-image {
            width: 100%;
            height: 220px;
            object-fit: cover;
            display: block;
            background: #f8fafc;
            animation: mediaImageIn 260ms ease both;
          }

          .media-caption {
            padding: 10px 12px;
            font-size: 12px;
            color: #475467;
            border-top: 1px solid #eef2f7;
            background: #fcfcfd;
          }

          .media-block {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 14px;
            background: #ffffff;
            animation: mediaCardIn 260ms ease both;
          }

          @keyframes mediaCardIn {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes mediaImageIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>

      <Layout>
        <Layout.Section>
          <div className="dashboard-shell">
            {pageError ? (
              <Banner tone="critical" title="Something went wrong">
                <p>{pageError}</p>
              </Banner>
            ) : null}

            {pageMessage ? (
              <Banner tone="success" title="Success">
                <p>{pageMessage}</p>
              </Banner>
            ) : null}

            <div className="hero-surface">
              <BlockStack gap="500">
                <InlineStack align="space-between" wrap gap="300">
                  <BlockStack gap="150">
                    <span className="hero-kicker">
                      <span className="hero-dot" />
                      Review Dashboard
                    </span>

                    <div>
                      <Text as="h2" variant="heading2xl">
                        Review Overview
                      </Text>
                      <div style={{ marginTop: 6 }}>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Track moderation, ratings, and distribution across all review types.
                        </Text>
                      </div>
                    </div>
                  </BlockStack>

                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.86)",
                      border: "1px solid #dbeafe",
                      boxShadow: "0 10px 24px rgba(59, 130, 246, 0.08)",
                    }}
                  >
                    <BlockStack gap="050">
                      <Text as="span" variant="bodySm" tone="subdued">
                        Live Review Count
                      </Text>
                      <Text as="span" variant="headingLg">
                        {reviewStats.total} reviews
                      </Text>
                    </BlockStack>
                  </div>
                </InlineStack>

                <div className="premium-stats-grid">
                  <PremiumStatCard
                    title="Total Reviews"
                    value={reviewStats.total}
                    helper="Overall moderation volume"
                    accent="blue"
                    softLabel="All"
                  />
                  <PremiumStatCard
                    title="Average Rating"
                    value={`${reviewStats.average}/5`}
                    helper={renderStars(Math.round(Number(reviewStats.average)))}
                    accent="violet"
                    softLabel="Quality"
                  />
                  <PremiumStatCard
                    title="Approved"
                    value={reviewStats.approved}
                    helper="Visible to shoppers"
                    accent="green"
                    softLabel="Live"
                  />
                  <PremiumStatCard
                    title="Pending"
                    value={reviewStats.pending}
                    helper="Needs moderation"
                    accent="amber"
                    softLabel="Queue"
                  />
                  <PremiumStatCard
                    title="Rejected"
                    value={reviewStats.rejected}
                    helper="Hidden from storefront"
                    accent="red"
                    softLabel="Blocked"
                  />
                  <PremiumStatCard
                    title="Pinned"
                    value={reviewStats.pinned}
                    helper="Highlighted reviews"
                    accent="slate"
                    softLabel="Featured"
                  />
                  <PremiumStatCard
                    title="Product Reviews"
                    value={reviewStats.productReviews}
                    helper="Item-specific feedback"
                    accent="blue"
                    softLabel="Product"
                  />
                  <PremiumStatCard
                    title="Collection Reviews"
                    value={reviewStats.collectionReviews}
                    helper="Category-based sentiment"
                    accent="amber"
                    softLabel="Collection"
                  />
                  <PremiumStatCard
                    title="Store Reviews"
                    value={reviewStats.storeReviews}
                    helper="Brand trust signals"
                    accent="violet"
                    softLabel="Store"
                  />
                </div>
              </BlockStack>
            </div>

            <div className="premium-filter-panel">
              <div className="premium-filter-header">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    Smart Filters
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Narrow down reviews by type, status, shop, target ID, handle, or legacy product ID.
                  </Text>
                </BlockStack>

                <InlineStack gap="200" wrap>
                  <span className="filter-chip">
                    Active Filters: {activeFilterCount}
                  </span>
                  <Button variant="primary" onClick={applyFilters}>
                    Apply Filters
                  </Button>
                  <Button onClick={resetFilters}>Reset</Button>
                </InlineStack>
              </div>

              <Divider />

              <div style={{ height: 16 }} />

              <div className="premium-input-grid">
                <div className="field-shell">
                  <Select
                    label="Status"
                    options={getStatusOptions()}
                    value={filters.status}
                    onChange={handleFilterChange("status")}
                  />
                </div>

                <div className="field-shell">
                  <Select
                    label="Review Type"
                    options={getReviewTypeOptions(true)}
                    value={filters.reviewType}
                    onChange={handleFilterChange("reviewType")}
                  />
                </div>

                {/* <div className="field-shell">
                  <TextField
                    label="Shop"
                    value={filters.shop}
                    onChange={handleFilterChange("shop")}
                    autoComplete="off"
                    placeholder="Enter shop domain"
                  />
                </div> */}

                {/* <div className="field-shell">
                  <TextField
                    label="Target ID"
                    value={filters.targetId}
                    onChange={handleFilterChange("targetId")}
                    autoComplete="off"
                    placeholder="Product / Collection target id"
                  />
                </div> */}

                {/* <div className="field-shell">
                  <TextField
                    label="Target Handle"
                    value={filters.targetHandle}
                    onChange={handleFilterChange("targetHandle")}
                    autoComplete="off"
                    placeholder="Collection handle"
                  />
                </div>

                <div className="field-shell">
                  <TextField
                    label="Legacy Product ID"
                    value={filters.productId}
                    onChange={handleFilterChange("productId")}
                    autoComplete="off"
                    placeholder="Old product id filter"
                  />
                </div> */}
              </div>
            </div>

            <Card roundedAbove="sm">
              <BlockStack gap="0">
                <div style={{ padding: 20 }}>
                  <InlineStack align="space-between" wrap gap="300">
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingLg">
                        Reviews Table
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Table view with media modal and fixed 10 items per page.
                      </Text>
                    </BlockStack>

                    <Badge tone={reviews.length ? "success" : "attention"}>
                      {reviews.length} items
                    </Badge>
                  </InlineStack>
                </div>

                <Divider />

                {loading ? (
                  <Box padding="600">
                    <InlineStack align="center">
                      <Spinner size="large" />
                    </InlineStack>
                  </Box>
                ) : reviews.length === 0 ? (
                  <div style={{ padding: 20 }}>
                    <EmptyState
                      heading="No reviews found"
                      image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                      action={{ content: "Create review", onAction: openCreateModal }}
                    >
                      <p>Create your first review or change the current filters.</p>
                    </EmptyState>
                  </div>
                ) : (
                  <>
                    <div className="reviews-table-wrap">
                      <table className="reviews-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Review</th>
                            <th>Target</th>
                            <th>Rating</th>
                            <th>Status</th>
                            <th>Helpful</th>
                            <th>Media</th>
                            <th>Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {paginatedReviews.map((review) => {
                            const target = getReviewTargetSummary(review);
                            const mediaCount = getMediaCount(review);

                            return (
                              <tr key={review.id}>
                                <td style={{ width: 140 }}>
                                  <div className="table-title">
                                    {formatDate(review.createdAt)}
                                  </div>
                                  <div className="table-subtext">
                                    Updated: {formatDate(review.updatedAt)}
                                  </div>
                                </td>

                                <td style={{ width: 220 }}>
                                  <div className="table-title">
                                    {review.customerName || "-"}
                                  </div>
                                  <div className="table-subtext">
                                    {review.customerEmail || "No email"}
                                  </div>
                                  <div className="table-subtext" style={{ marginTop: 6 }}>
                                    Shop: {review.shop || "-"}
                                  </div>
                                </td>

                                <td style={{ width: 320 }}>
                                  <div className="table-title">
                                    {review.title || "Untitled review"}
                                  </div>
                                  <div className="table-subtext review-message-preview">
                                    {review.message || "-"}
                                  </div>
                                </td>

                                <td style={{ width: 250 }}>
                                  <InlineStack gap="200" wrap blockAlign="center">
                                    <Badge tone={getReviewTypeTone(review.reviewType)}>
                                      {getReviewTypeShortLabel(review.reviewType)}
                                    </Badge>
                                    {review.isPinned ? <Badge tone="info">Pinned</Badge> : null}
                                  </InlineStack>

                                  <div className="table-title" style={{ marginTop: 8 }}>
                                    {target.title}
                                  </div>
                                  <div className="table-subtext">{target.subText}</div>
                                </td>

                                <td style={{ width: 160 }}>
                                  <Badge tone={getBadgeTone(review.status)}>
                                    {review.rating}/5
                                  </Badge>
                                  <div className="table-subtext" style={{ marginTop: 8 }}>
                                    {renderStars(review.rating)}
                                  </div>
                                </td>

                                <td style={{ width: 140 }}>
                                  <StatusPill status={review.status} />
                                </td>

                                <td style={{ width: 100 }}>
                                  <div className="table-title">
                                    {String(Number(review.helpfulCount || 0))}
                                  </div>
                                </td>

                                <td style={{ width: 170 }}>
                                  <Button
                                    onClick={() => openMediaModal(review)}
                                    disabled={!hasMedia(review)}
                                  >
                                    {hasMedia(review)
                                      ? `Show Images (${mediaCount})`
                                      : "No Media"}
                                  </Button>
                                </td>

                                <td style={{ width: 320 }}>
                                  <InlineStack gap="200" wrap>
                                    <Button onClick={() => openEditModal(review)}>Edit</Button>

                                    <Button
                                      variant="primary"
                                      tone="success"
                                      loading={approveLoadingId === review.id}
                                      onClick={() => handleApprove(review.id)}
                                    >
                                      Approve
                                    </Button>

                                    <Button
                                      tone="critical"
                                      loading={rejectLoadingId === review.id}
                                      onClick={() => handleReject(review.id)}
                                    >
                                      Reject
                                    </Button>

                                    {review.isPinned ? (
                                      <Button
                                        loading={pinLoadingId === review.id}
                                        onClick={() => handleUnpin(review.id)}
                                      >
                                        Unpin
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="primary"
                                        loading={pinLoadingId === review.id}
                                        onClick={() => handlePin(review.id)}
                                      >
                                        Pin
                                      </Button>
                                    )}

                                    <Button
                                      variant="primary"
                                      tone="critical"
                                      loading={deleteLoadingId === review.id}
                                      onClick={() => handleDelete(review.id)}
                                    >
                                      Delete
                                    </Button>
                                  </InlineStack>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <Divider />

                    <div style={{ padding: 20 }}>
                      <InlineStack align="space-between" wrap gap="300">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Showing {startItem}-{endItem} of {reviews.length} reviews
                        </Text>

                        <InlineStack gap="200" wrap>
                          <Button
                            disabled={safeCurrentPage === 1}
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                          >
                            Previous
                          </Button>

                          {visiblePages.map((page, index) =>
                            page === "..." ? (
                              <div
                                key={`dots-${index}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "0 6px",
                                  color: "#667085",
                                  fontWeight: 600,
                                }}
                              >
                                ...
                              </div>
                            ) : (
                              <Button
                                key={page}
                                variant={page === safeCurrentPage ? "primary" : undefined}
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            )
                          )}

                          <Button
                            disabled={safeCurrentPage === totalPages}
                            onClick={() =>
                              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                            }
                          >
                            Next
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </div>
                  </>
                )}
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>

      <Modal
        open={mediaModalOpen}
        onClose={closeMediaModal}
        title={
          selectedMediaReview
            ? `Review Media - ${selectedMediaReview.customerName || "Customer"}`
            : "Review Media"
        }
        large
        secondaryActions={[
          {
            content: "Close",
            onAction: closeMediaModal,
          },
        ]}
      >
        <Modal.Section>
          {selectedMediaReview ? (
            <BlockStack gap="400">
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  animation: "mediaCardIn 240ms ease both",
                }}
              >
                <BlockStack gap="100">
                  <Text as="h3" variant="headingMd">
                    {selectedMediaReview.title || "Untitled review"}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {selectedMediaReview.message || "-"}
                  </Text>
                </BlockStack>
              </div>

              {selectedImages.length ? (
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Images
                  </Text>

                  <div className="media-grid">
                    {selectedImages.map((img, index) => (
                      <div
                        key={`${img}-${index}`}
                        className="media-card"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <a
                          href={img}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: "block", textDecoration: "none" }}
                        >
                          <img
                            src={img}
                            alt={`Review media ${index + 1}`}
                            className="media-image"
                            style={{ animationDelay: `${index * 60}ms` }}
                          />
                          <div className="media-caption">
                            Image {index + 1}
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                </BlockStack>
              ) : null}

              {selectedMediaReview.reviewVideoUrl ? (
                <div className="media-block" style={{ animationDelay: "120ms" }}>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      Uploaded Video
                    </Text>
                    <video
                      src={selectedMediaReview.reviewVideoUrl}
                      controls
                      style={{
                        width: "100%",
                        maxWidth: 720,
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        background: "#000",
                        display: "block",
                      }}
                    />
                  </BlockStack>
                </div>
              ) : null}

              {selectedYoutubeEmbedUrl ? (
                <div className="media-block" style={{ animationDelay: "180ms" }}>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      YouTube Video
                    </Text>
                    <iframe
                      src={selectedYoutubeEmbedUrl}
                      title="Review YouTube video"
                      width="100%"
                      height="400"
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        background: "#fff",
                        display: "block",
                        maxWidth: "100%",
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </BlockStack>
                </div>
              ) : null}

              {!selectedImages.length &&
              !selectedMediaReview.reviewVideoUrl &&
              !selectedYoutubeEmbedUrl ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  No media found for this review.
                </Text>
              ) : null}
            </BlockStack>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={isEditMode ? "Edit review" : "Create review"}
        primaryAction={{
          content: isEditMode ? "Update review" : "Save review",
          onAction: handleSave,
          loading: saveLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: closeModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {!isEditMode ? (
              <TextField
                label="Shop"
                value={formData.shop}
                onChange={handleFieldChange("shop")}
                autoComplete="off"
              />
            ) : (
              <TextField
                label="Shop"
                value={formData.shop}
                disabled
                autoComplete="off"
              />
            )}

            <Select
              label="Review Type"
              options={getReviewTypeOptions(false)}
              value={formData.reviewType}
              onChange={handleFieldChange("reviewType")}
            />

            {currentReviewType === "product" ? (
              <>
                <TextField
                  label="Product ID / Target ID"
                  value={formData.targetId}
                  onChange={handleFieldChange("targetId")}
                  autoComplete="off"
                />

                <TextField
                  label="Product Title / Target Title"
                  value={formData.targetTitle}
                  onChange={handleFieldChange("targetTitle")}
                  autoComplete="off"
                />
              </>
            ) : null}

            {currentReviewType === "collection" ? (
              <>
                <TextField
                  label="Collection ID / Target ID"
                  value={formData.targetId}
                  onChange={handleFieldChange("targetId")}
                  autoComplete="off"
                />

                <TextField
                  label="Collection Handle"
                  value={formData.targetHandle}
                  onChange={handleFieldChange("targetHandle")}
                  autoComplete="off"
                  placeholder="summer-shirts"
                />

                <TextField
                  label="Collection Title / Target Title"
                  value={formData.targetTitle}
                  onChange={handleFieldChange("targetTitle")}
                  autoComplete="off"
                />
              </>
            ) : null}

            {currentReviewType === "store" ? (
              <TextField
                label="Store Title"
                value={formData.targetTitle}
                onChange={handleFieldChange("targetTitle")}
                autoComplete="off"
                placeholder="Optional store display title"
              />
            ) : null}

            <TextField
              label="Customer name"
              value={formData.customerName}
              onChange={handleFieldChange("customerName")}
              autoComplete="off"
            />

            <TextField
              label="Customer email"
              type="email"
              value={formData.customerEmail}
              onChange={handleFieldChange("customerEmail")}
              autoComplete="off"
            />

            <Select
              label="Rating"
              options={getRatingOptions()}
              value={formData.rating}
              onChange={handleFieldChange("rating")}
            />

            <TextField
              label="Review title"
              value={formData.title}
              onChange={handleFieldChange("title")}
              autoComplete="off"
            />

            <TextField
              label="Message"
              value={formData.message}
              onChange={handleFieldChange("message")}
              multiline={4}
              autoComplete="off"
            />

            <TextField
              label="Review video URL"
              value={formData.reviewVideoUrl}
              onChange={handleFieldChange("reviewVideoUrl")}
              autoComplete="off"
              placeholder="https://...mp4"
            />

            <TextField
              label="YouTube URL"
              value={formData.reviewYoutubeUrl}
              onChange={handleFieldChange("reviewYoutubeUrl")}
              autoComplete="off"
              placeholder="https://www.youtube.com/watch?v=..."
            />

            {isEditMode ? (
              <Select
                label="Status"
                options={[
                  { label: "Pending", value: "pending" },
                  { label: "Approved", value: "approved" },
                  { label: "Rejected", value: "rejected" },
                ]}
                value={formData.status}
                onChange={handleFieldChange("status")}
              />
            ) : null}

            {isEditMode ? (
              <Select
                label="Pinned"
                options={[
                  { label: "Not pinned", value: "false" },
                  { label: "Pinned", value: "true" },
                ]}
                value={formData.isPinned}
                onChange={handleFieldChange("isPinned")}
              />
            ) : null}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

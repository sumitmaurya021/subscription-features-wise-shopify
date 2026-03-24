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

const GET_REVIEWS_QUERY = `
  query GetReviews($shop: String, $status: String, $productId: String) {
    reviews(shop: $shop, status: $status, productId: $productId) {
      success
      message
      count
      data {
        id
        shop
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

function getRatingOptions() {
  return [
    { label: "1 Star", value: "1" },
    { label: "2 Stars", value: "2" },
    { label: "3 Stars", value: "3" },
    { label: "4 Stars", value: "4" },
    { label: "5 Stars", value: "5" },
  ];
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

function StatCard({ title, value, helper, tone = "base" }) {
  const backgroundMap = {
    base: "#ffffff",
    success: "#f0fdf4",
    warning: "#fffbeb",
    critical: "#fef2f2",
  };

  return (
    <div
      style={{
        background: backgroundMap[tone] || "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        minHeight: 108,
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <BlockStack gap="100">
        <Text as="span" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <Text as="h3" variant="heading2xl">
          {value}
        </Text>
        {helper ? (
          <Text as="span" variant="bodySm" tone="subdued">
            {helper}
          </Text>
        ) : null}
      </BlockStack>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <Text as="span" variant="bodySm" tone="subdued">
      {children}
    </Text>
  );
}

function InfoLine({ label, value, breakWord = false }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          marginTop: 4,
          wordBreak: breakWord ? "break-word" : "normal",
          overflowWrap: breakWord ? "anywhere" : "normal",
        }}
      >
        <Text as="p" variant="bodySm">
          {value || "-"}
        </Text>
      </div>
    </div>
  );
}

function ReviewImageThumb({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: 52,
        height: 52,
        objectFit: "cover",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        display: "block",
        background: "#f9fafb",
      }}
    />
  );
}

function ReviewMediaCard({ review }) {
  const youtubeEmbedUrl =
    getYoutubeEmbedUrl(review.reviewYoutubeUrl) || review.reviewYoutubeUrl;

  return (
    <div
      style={{
        padding: 14,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
      }}
    >
      <BlockStack gap="200">
        <Text as="h4" variant="headingSm">
          Media
        </Text>

        {Array.isArray(review.reviewImages) && review.reviewImages.length ? (
          <div>
            <FieldLabel>Images</FieldLabel>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {review.reviewImages.map((img, i) => (
                <ReviewImageThumb key={i} src={img} alt={`Review image ${i + 1}`} />
              ))}
            </div>
          </div>
        ) : null}

        {review.reviewVideoUrl ? (
          <div>
            <FieldLabel>Uploaded Video</FieldLabel>
            <div style={{ marginTop: 8 }}>
              <video
                src={review.reviewVideoUrl}
                controls
                style={{
                  width: "100%",
                  maxWidth: 260,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#000",
                  display: "block",
                }}
              />
            </div>
          </div>
        ) : null}

        {youtubeEmbedUrl ? (
          <div>
            <FieldLabel>YouTube Video</FieldLabel>
            <div style={{ marginTop: 8 }}>
              <iframe
                src={youtubeEmbedUrl}
                title="Review YouTube video"
                width="260"
                height="160"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fff",
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        ) : null}

        {!(
          (Array.isArray(review.reviewImages) && review.reviewImages.length) ||
          review.reviewVideoUrl ||
          youtubeEmbedUrl
        ) ? (
          <Text as="p" variant="bodySm" tone="subdued">
            No media added
          </Text>
        ) : null}
      </BlockStack>
    </div>
  );
}

function ReviewCard({
  review,
  openEditModal,
  handleApprove,
  handleReject,
  handleDelete,
  handlePin,
  handleUnpin,
  approveLoadingId,
  rejectLoadingId,
  deleteLoadingId,
  pinLoadingId,
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <div
        style={{
          padding: 18,
          borderBottom: "1px solid #f1f5f9",
          background: "#fcfcfd",
        }}
      >
        <InlineStack align="space-between" blockAlign="start" wrap gap="300">
          <BlockStack gap="050">
            <InlineStack gap="200" wrap blockAlign="center">
              <Text as="h3" variant="headingMd">
                {review.productTitle || "Untitled Product"}
              </Text>
              {review.isPinned ? <Badge tone="info">Pinned</Badge> : null}
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Product ID: {review.productId || "-"} · Shop: {review.shop || "-"}
            </Text>
          </BlockStack>

          <InlineStack gap="200" wrap blockAlign="center">
            <StatusPill status={review.status} />
            <Badge tone={getBadgeTone(review.status)}>
              {review.rating}/5 · {renderStars(review.rating)}
            </Badge>
          </InlineStack>
        </InlineStack>
      </div>

      <div style={{ padding: 18 }}>
        <BlockStack gap="400">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr)",
              gap: 16,
            }}
          >
            <div
              style={{
                padding: 14,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
              }}
            >
              <BlockStack gap="200">
                <Text as="h4" variant="headingSm">
                  Customer
                </Text>
                <InfoLine label="Name" value={review.customerName} breakWord />
                <InfoLine
                  label="Email"
                  value={review.customerEmail}
                  breakWord
                />
              </BlockStack>
            </div>

            <div
              style={{
                padding: 14,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
              }}
            >
              <BlockStack gap="200">
                <Text as="h4" variant="headingSm">
                  Review Meta
                </Text>
                <InfoLine label="Title" value={review.title} breakWord />
                <InfoLine
                  label="Helpful Count"
                  value={String(Number(review.helpfulCount || 0))}
                />
                <InfoLine label="Created" value={formatDate(review.createdAt)} />
              </BlockStack>
            </div>

            <ReviewMediaCard review={review} />
          </div>

          <div
            style={{
              padding: 16,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
            }}
          >
            <BlockStack gap="150">
              <FieldLabel>Review Message</FieldLabel>
              <Text as="p" variant="bodyMd">
                {review.message || "-"}
              </Text>
            </BlockStack>
          </div>

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
        </BlockStack>
      </div>
    </div>
  );
}

const initialFormState = {
  id: null,
  shop: "",
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

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [approveLoadingId, setApproveLoadingId] = useState(null);
  const [rejectLoadingId, setRejectLoadingId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pinLoadingId, setPinLoadingId] = useState(null);

  const [formData, setFormData] = useState(initialFormState);
  const isEditMode = Boolean(formData.id);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const data = await graphqlRequest(GET_REVIEWS_QUERY, {
        shop: shopFilter || null,
        status: statusFilter || null,
        productId: productIdFilter || null,
      });

      setReviews(data.reviews?.data || []);
    } catch (error) {
      setPageError(error.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [shopFilter, statusFilter, productIdFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const pending = reviews.filter((r) => r.status === "pending").length;
    const rejected = reviews.filter((r) => r.status === "rejected").length;
    const pinned = reviews.filter((r) => Boolean(r.isPinned)).length;

    const average =
      total > 0
        ? (
            reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / total
          ).toFixed(1)
        : "0.0";

    return { total, approved, pending, rejected, pinned, average };
  }, [reviews]);

  const resetForm = () => {
    setFormData(initialFormState);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (review) => {
    setFormData({
      id: review.id,
      shop: review.shop || "",
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

  const handleFieldChange = (field) => (value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setPageError("");
      setPageMessage("");

      if (
        !formData.shop ||
        !formData.productId ||
        !formData.customerName ||
        !formData.rating ||
        !formData.message
      ) {
        setPageError(
          "Shop, Product ID, Customer name, Rating, and Message are required."
        );
        return;
      }

      if (
        formData.reviewYoutubeUrl &&
        !getYoutubeEmbedUrl(formData.reviewYoutubeUrl)
      ) {
        setPageError("Please enter a valid YouTube link.");
        return;
      }

      if (isEditMode) {
        const data = await graphqlRequest(UPDATE_REVIEW_MUTATION, {
          id: formData.id,
          input: {
            productTitle: formData.productTitle || null,
            customerName: formData.customerName,
            customerEmail: formData.customerEmail || null,
            rating: Number(formData.rating),
            title: formData.title || null,
            message: formData.message,
            reviewVideoUrl: formData.reviewVideoUrl || null,
            reviewYoutubeUrl: formData.reviewYoutubeUrl || null,
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
            shop: formData.shop,
            productId: formData.productId,
            productTitle: formData.productTitle || null,
            customerName: formData.customerName,
            customerEmail: formData.customerEmail || null,
            rating: Number(formData.rating),
            title: formData.title || null,
            message: formData.message,
            reviewVideoUrl: formData.reviewVideoUrl || null,
            reviewYoutubeUrl: formData.reviewYoutubeUrl || null,
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

  const resetFilters = () => {
    setStatusFilter("");
    setShopFilter("");
    setProductIdFilter("");
  };

  return (
    <Page
      title="Product Reviews"
      subtitle="Clean, compact, and professional review moderation dashboard."
      primaryAction={{ content: "Create review", onAction: openCreateModal }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
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

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <InlineStack align="space-between" wrap gap="300">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingLg">
                      Review Overview
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Quick insight into moderation status and rating quality.
                    </Text>
                  </BlockStack>

                  <Badge tone="info">{reviewStats.total} total reviews</Badge>
                </InlineStack>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 14,
                  }}
                >
                  <StatCard title="Total Reviews" value={reviewStats.total} />
                  <StatCard
                    title="Average Rating"
                    value={`${reviewStats.average}/5`}
                    helper={renderStars(Math.round(Number(reviewStats.average)))}
                  />
                  <StatCard
                    title="Approved"
                    value={reviewStats.approved}
                    tone="success"
                  />
                  <StatCard
                    title="Pending"
                    value={reviewStats.pending}
                    tone="warning"
                  />
                  <StatCard
                    title="Rejected"
                    value={reviewStats.rejected}
                    tone="critical"
                  />
                  <StatCard title="Pinned" value={reviewStats.pinned} />
                </div>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <InlineStack align="space-between" wrap gap="300">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingMd">
                      Filters
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Narrow down reviews by moderation status, shop, or product.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="200" wrap>
                    <Button variant="primary" onClick={fetchReviews}>
                      Apply filters
                    </Button>
                    <Button onClick={resetFilters}>Reset</Button>
                  </InlineStack>
                </InlineStack>

                <Divider />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <Select
                    label="Status"
                    options={getStatusOptions()}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />

                  <TextField
                    label="Shop"
                    value={shopFilter}
                    onChange={setShopFilter}
                    autoComplete="off"
                    placeholder="Enter shop domain"
                  />

                  <TextField
                    label="Product ID"
                    value={productIdFilter}
                    onChange={setProductIdFilter}
                    autoComplete="off"
                    placeholder="Enter product ID"
                  />
                </div>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="0">
                <div style={{ padding: 20 }}>
                  <InlineStack align="space-between" wrap gap="300">
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingLg">
                        All Reviews
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Compact card layout for easier reading and better admin
                        actions.
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
                  <div style={{ padding: 20 }}>
                    <BlockStack gap="300">
                      {reviews.map((review) => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          openEditModal={openEditModal}
                          handleApprove={handleApprove}
                          handleReject={handleReject}
                          handleDelete={handleDelete}
                          handlePin={handlePin}
                          handleUnpin={handleUnpin}
                          approveLoadingId={approveLoadingId}
                          rejectLoadingId={rejectLoadingId}
                          deleteLoadingId={deleteLoadingId}
                          pinLoadingId={pinLoadingId}
                        />
                      ))}
                    </BlockStack>
                  </div>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

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

            {!isEditMode ? (
              <TextField
                label="Product ID"
                value={formData.productId}
                onChange={handleFieldChange("productId")}
                autoComplete="off"
              />
            ) : (
              <TextField
                label="Product ID"
                value={formData.productId}
                disabled
                autoComplete="off"
              />
            )}

            <TextField
              label="Product title"
              value={formData.productTitle}
              onChange={handleFieldChange("productTitle")}
              autoComplete="off"
            />

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

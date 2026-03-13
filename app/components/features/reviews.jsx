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
        helpfulCount
        status
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
        helpfulCount
        status
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
        helpfulCount
        status
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
  const safeRating = Number(rating || 0);
  return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
}

function getStatusStyles(status) {
  if (status === "approved") {
    return {
      color: "#166534",
      background: "linear-gradient(135deg, #ecfdf3 0%, #dcfce7 100%)",
      border: "1px solid rgba(22, 101, 52, 0.16)",
      dot: "#22c55e",
      shadow: "0 8px 18px rgba(34, 197, 94, 0.12)",
    };
  }

  if (status === "rejected") {
    return {
      color: "#991b1b",
      background: "linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)",
      border: "1px solid rgba(153, 27, 27, 0.14)",
      dot: "#ef4444",
      shadow: "0 8px 18px rgba(239, 68, 68, 0.10)",
    };
  }

  return {
    color: "#92400e",
    background: "linear-gradient(135deg, #fffaf0 0%, #fef3c7 100%)",
    border: "1px solid rgba(146, 64, 14, 0.14)",
    dot: "#f59e0b",
    shadow: "0 8px 18px rgba(245, 158, 11, 0.12)",
  };
}

function StatusPill({ status }) {
  const styles = getStatusStyles(status);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        borderRadius: "999px",
        background: styles.background,
        border: styles.border,
        boxShadow: styles.shadow,
        color: styles.color,
        fontSize: "13px",
        fontWeight: 700,
        textTransform: "capitalize",
        letterSpacing: "0.2px",
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "999px",
          background: styles.dot,
          display: "inline-block",
        }}
      />
      {status}
    </div>
  );
}

function StatCard({ title, value, tone = "base" }) {
  return (
    <div
      style={{
        minWidth: "220px",
        flex: "1 1 220px",
        borderRadius: "20px",
        padding: "20px 22px",
        background:
          tone === "success"
            ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
            : tone === "warning"
            ? "linear-gradient(135deg, #fffaf0 0%, #fef3c7 100%)"
            : tone === "critical"
            ? "linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)"
            : "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
      }}
    >
      <BlockStack gap="100">
        <Text as="span" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <Text as="h3" variant="heading2xl">
          {value}
        </Text>
      </BlockStack>
    </div>
  );
}

function TableLabel({ children }) {
  return (
    <Text as="p" variant="bodySm" tone="subdued">
      {children}
    </Text>
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
  status: "pending",
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

    const average =
      total > 0
        ? (
            reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / total
          ).toFixed(1)
        : "0.0";

    return { total, approved, pending, rejected, average };
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
      status: review.status || "pending",
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
            status: formData.status,
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

  return (
    <Page
      title="Product Reviews"
      subtitle="Manage, moderate and maintain customer trust with a beautifully organized review workspace."
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
                <Text as="h2" variant="headingLg">
                  Review Overview
                </Text>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <StatCard title="Total Reviews" value={reviewStats.total} />
                  <StatCard
                    title="Average Rating"
                    value={reviewStats.average}
                    tone="base"
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
                </div>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <InlineStack align="space-between" wrap gap="300">
                  <Text as="h2" variant="headingMd">
                    Filters
                  </Text>

                  <InlineStack gap="200" wrap>
                    <Button onClick={fetchReviews}>Apply filters</Button>
                    <Button
                      onClick={() => {
                        setStatusFilter("");
                        setShopFilter("");
                        setProductIdFilter("");
                      }}
                    >
                      Reset
                    </Button>
                  </InlineStack>
                </InlineStack>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "16px",
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
                  />

                  <TextField
                    label="Product ID"
                    value={productIdFilter}
                    onChange={setProductIdFilter}
                    autoComplete="off"
                  />
                </div>
              </BlockStack>
            </Card>

            <Card padding="0" roundedAbove="sm">
              <BlockStack gap="0">
                <div
                  style={{
                    padding: "20px 20px 0 20px",
                  }}
                >
                  <InlineStack align="space-between" wrap gap="300">
                    <Text as="h2" variant="headingLg">
                      All Reviews
                    </Text>
                    <Badge tone={getBadgeTone(reviews.length ? "approved" : "pending")}>
                      {reviews.length} items
                    </Badge>
                  </InlineStack>
                </div>

                {loading ? (
                  <Box paddingBlockStart="400" paddingBlockEnd="400">
                    <InlineStack align="center">
                      <Spinner size="large" />
                    </InlineStack>
                  </Box>
                ) : reviews.length === 0 ? (
                  <div style={{ padding: "20px" }}>
                    <EmptyState
                      heading="No reviews found"
                      image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                      action={{ content: "Create review", onAction: openCreateModal }}
                    >
                      <p>Create your first review or adjust the current filters.</p>
                    </EmptyState>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      overflowX: "auto",
                      padding: "20px",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        minWidth: "1450px",
                        background: "#ffffff",
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        borderRadius: "18px",
                        overflow: "hidden",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background:
                              "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                          }}
                        >
                          {[
                            "Product",
                            "Customer",
                            "Rating",
                            "Status",
                            "Message",
                            "Images",
                            "helpfulCount",
                            "Created",
                            "Actions",
                          ].map((heading) => (
                            <th
                              key={heading}
                              style={{
                                textAlign: "left",
                                padding: "16px 18px",
                                fontSize: "13px",
                                fontWeight: 700,
                                color: "#334155",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {reviews.map((review, index) => (
                          <tr
                            key={review.id}
                            style={{
                              background: index % 2 === 0 ? "#ffffff" : "#fcfdff",
                            }}
                          >
                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "240px",
                                maxWidth: "300px",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}
                            >
                              <BlockStack gap="100">
                                <Text as="p" variant="bodyMd" fontWeight="semibold">
                                  {review.productTitle || "Untitled Product"}
                                </Text>
                                <TableLabel>Product ID</TableLabel>
                                <Text as="p" variant="bodySm">
                                  {review.productId || "-"}
                                </Text>
                                <TableLabel>Shop</TableLabel>
                                <Text as="p" variant="bodySm">
                                  {review.shop || "-"}
                                </Text>
                              </BlockStack>
                            </td>

                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "220px",
                                maxWidth: "280px",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}
                            >
                              <BlockStack gap="100">
                                <Text as="p" variant="bodyMd" fontWeight="semibold">
                                  {review.customerName || "-"}
                                </Text>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  {review.customerEmail || "-"}
                                </Text>
                                {review.title ? (
                                  <>
                                    <TableLabel>Review Title</TableLabel>
                                    <Text as="p" variant="bodySm">
                                      {review.title}
                                    </Text>
                                  </>
                                ) : null}
                              </BlockStack>
                            </td>

                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "150px",
                                whiteSpace: "normal",
                              }}
                            >
                              <BlockStack gap="100">
                                <Text
                                  as="p"
                                  variant="bodyMd"
                                  fontWeight="semibold"
                                >
                                  {review.rating}/5
                                </Text>
                                <Text
                                  as="p"
                                  variant="bodySm"
                                  tone="subdued"
                                >
                                  {renderStars(review.rating)}
                                </Text>
                              </BlockStack>
                            </td>

                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "150px",
                              }}
                            >
                              <StatusPill status={review.status} />
                            </td>

                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "360px",
                                maxWidth: "520px",
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                                lineHeight: "1.6",
                              }}
                            >
                              <BlockStack gap="100">
                                <Text as="p" variant="bodyMd">
                                  {review.message || "-"}
                                </Text>
                              </BlockStack>
                            </td>
                              <td
                                style={{
                                  padding: "18px",
                                  verticalAlign: "top",
                                  borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                  minWidth: "220px",
                                }}
                              >
                                {Array.isArray(review.reviewImages) && review.reviewImages.length ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "8px",
                                    }}
                                  >
                                    {review.reviewImages.map((img, i) => (
                                      <img
                                        key={i}
                                        src={img}
                                        alt={`Review ${i + 1}`}
                                        style={{
                                          width: "56px",
                                          height: "56px",
                                          objectFit: "cover",
                                          borderRadius: "10px",
                                          border: "1px solid rgba(15, 23, 42, 0.08)",
                                        }}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    No images
                                  </Text>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "18px",
                                  verticalAlign: "top",
                                  borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                  minWidth: "120px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Text as="p" variant="bodyMd" fontWeight="semibold">
                                  {Number(review.helpfulCount || 0)}
                                </Text>
                              </td>
                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "140px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Text as="p" variant="bodyMd">
                                {formatDate(review.createdAt)}
                              </Text>
                            </td>

                            <td
                              style={{
                                padding: "18px",
                                verticalAlign: "top",
                                borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                                minWidth: "240px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                }}
                              >
                                <Button onClick={() => openEditModal(review)}>
                                  Edit
                                </Button>

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

                                <Button
                                  variant="primary"
                                  tone="critical"
                                  loading={deleteLoadingId === review.id}
                                  onClick={() => handleDelete(review.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  IndexTable,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  TextField,
  Select,
  EmptyState,
  Spinner,
  Box,
  Divider,
} from "@shopify/polaris";
import { Toaster, toast } from "react-hot-toast";

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

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");

  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);

      const data = await graphqlRequest(GET_REVIEWS_QUERY, {
        shop: shopFilter || null,
        status: statusFilter || null,
        productId: productIdFilter || null,
      });

      setReviews(data.reviews?.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [shopFilter, statusFilter, productIdFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async (id) => {
    try {
      setDeleteLoadingId(id);

      const data = await graphqlRequest(DELETE_REVIEW_MUTATION, { id });

      if (!data.deleteReview.success) {
        throw new Error(data.deleteReview.message || "Failed to delete review");
      }

      toast.success("Review deleted successfully");
      await fetchReviews();
    } catch (error) {
      toast.error(error.message || "Delete failed");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  function formatDate(dateValue) {
    if (!dateValue) return "-";

    const date = new Date(Number(dateValue));

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  const rowMarkup = useMemo(() => {
    return reviews.map((review, index) => (
      <IndexTable.Row id={review.id} key={review.id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {review.productTitle || "Untitled Product"}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              ID: {review.productId || "-"}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {review.customerName || "-"}
            </Text>
            <Text as="span" tone="subdued" variant="bodySm">
              {review.customerEmail || "-"}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" fontWeight="medium">
            {review.rating} / 5
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Box maxWidth="320px">
            <BlockStack gap="100">
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {review.title || "-"}
              </Text>
              <Text as="span" tone="subdued" variant="bodySm">
                {review.message || "-"}
              </Text>
            </BlockStack>
          </Box>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={getBadgeTone(review.status)}>
            {review.status || "pending"}
          </Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text as="span" variant="bodySm">
            {formatDate(review.createdAt)}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Button
            size="slim"
            tone="critical"
            loading={deleteLoadingId === review.id}
            onClick={() => handleDelete(review.id)}
          >
            Delete
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    ));
  }, [reviews, deleteLoadingId]);

  return (
    <>
      <Toaster position="top-right" />

      <Page fullWidth>
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      Reviews Dashboard
                    </Text>
                    <Text as="p" tone="subdued" variant="bodyMd">
                      Manage customer product reviews, filter records, and delete unwanted entries.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Filters
                    </Text>
                    <Text as="span" tone="subdued" variant="bodySm">
                      Total Reviews: {reviews.length}
                    </Text>
                  </InlineStack>

                  <Divider />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "16px",
                      alignItems: "end",
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
                      placeholder="Enter shop name"
                    />

                    <TextField
                      label="Product ID"
                      value={productIdFilter}
                      onChange={setProductIdFilter}
                      autoComplete="off"
                      placeholder="Enter product ID"
                    />

                    <InlineStack gap="200" align="start">
                      <Button variant="primary" onClick={fetchReviews}>
                        Apply
                      </Button>
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
                  </div>
                </BlockStack>
              </Card>

              <Card padding="0">
                {loading ? (
                  <div style={{ padding: "48px 24px" }}>
                    <BlockStack gap="300" align="center">
                      <InlineStack align="center">
                        <Spinner size="large" />
                      </InlineStack>
                      <Text as="p" tone="subdued">
                        Loading reviews...
                      </Text>
                    </BlockStack>
                  </div>
                ) : reviews.length === 0 ? (
                  <div style={{ padding: "24px" }}>
                    <EmptyState
                      heading="No reviews found"
                      image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                    >
                      <p>No reviews are available for the selected filters.</p>
                    </EmptyState>
                  </div>
                ) : (
                  <div style={{ width: "100%", overflowX: "auto" }}>
                    <IndexTable
                      resourceName={{ singular: "review", plural: "reviews" }}
                      itemCount={reviews.length}
                      selectable={false}
                      headings={[
                        { title: "Product" },
                        { title: "Customer" },
                        { title: "Rating" },
                        { title: "Review" },
                        { title: "Status" },
                        { title: "Created" },
                        { title: "Action" },
                      ]}
                    >
                      {rowMarkup}
                    </IndexTable>
                  </div>
                )}
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}
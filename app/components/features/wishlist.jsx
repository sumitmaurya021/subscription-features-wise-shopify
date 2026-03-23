import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Spinner,
  Banner,
  Box,
  TextField,
  Divider,
  EmptyState,
} from "@shopify/polaris";

const GRAPHQL_ENDPOINT = "/graphql";

const GET_WISHLIST_STATS = `
  query GetWishlistStats($shop: String) {
    wishlistStats(shop: $shop) {
      success
      message
      data {
        totalWishlistItems
        uniqueProductsWishlisted
        totalBackInStockSubscribers
        activeBackInStockSubscribers
      }
    }
  }
`;

const GET_WISHLIST_ITEMS = `
  query GetWishlistItems($shop: String, $productId: String) {
    wishlistItems(shop: $shop, productId: $productId) {
      success
      message
      count
      data {
        id
        shop
        productId
        variantId
        productTitle
        productHandle
        productImage
        productUrl
        customerId
        customerEmail
        sessionId
        ownerKey
        ownerType
        createdAt
      }
    }
  }
`;

const GET_BACK_IN_STOCK_REQUESTS = `
  query GetBackInStockRequests($shop: String, $productId: String) {
    backInStockRequests(shop: $shop, productId: $productId, isActive: true) {
      success
      message
      count
      data {
        id
        shop
        productId
        variantId
        productTitle
        customerName
        customerEmail
        isActive
        createdAt
      }
    }
  }
`;

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors[0].message || "GraphQL request failed");
  }

  return result.data;
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ title, value, helper }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        minHeight: 104,
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

function DataCard({ title, items, renderItem, emptyText }) {
  return (
    <Card roundedAbove="sm">
      <BlockStack gap="300">
        <InlineStack align="space-between" wrap gap="300">
          <Text as="h2" variant="headingMd">
            {title}
          </Text>
          <Badge tone={items.length ? "success" : "attention"}>
            {items.length} items
          </Badge>
        </InlineStack>

        <Divider />

        {!items.length ? (
          <EmptyState
            heading="No data found"
            image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
          >
            <p>{emptyText}</p>
          </EmptyState>
        ) : (
          <BlockStack gap="300">
            {items.map(renderItem)}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

export default function WishlistPage() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");

  const [stats, setStats] = useState({
    totalWishlistItems: 0,
    uniqueProductsWishlisted: 0,
    totalBackInStockSubscribers: 0,
    activeBackInStockSubscribers: 0,
  });

  const [wishlistItems, setWishlistItems] = useState([]);
  const [backInStockItems, setBackInStockItems] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const [statsData, wishlistData, bisData] = await Promise.all([
        graphqlRequest(GET_WISHLIST_STATS, {
          shop: shopFilter || null,
        }),
        graphqlRequest(GET_WISHLIST_ITEMS, {
          shop: shopFilter || null,
          productId: productIdFilter || null,
        }),
        graphqlRequest(GET_BACK_IN_STOCK_REQUESTS, {
          shop: shopFilter || null,
          productId: productIdFilter || null,
        }),
      ]);

      setStats(
        statsData?.wishlistStats?.data || {
          totalWishlistItems: 0,
          uniqueProductsWishlisted: 0,
          totalBackInStockSubscribers: 0,
          activeBackInStockSubscribers: 0,
        }
      );

      setWishlistItems(wishlistData?.wishlistItems?.data || []);
      setBackInStockItems(bisData?.backInStockRequests?.data || []);
    } catch (error) {
      setPageError(error.message || "Failed to load wishlist data");
    } finally {
      setLoading(false);
    }
  }, [shopFilter, productIdFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cards = useMemo(
    () => [
      {
        title: "Total Wishlist Saves",
        value: stats.totalWishlistItems,
        helper: "All saved wishlist records",
      },
      {
        title: "Unique Products",
        value: stats.uniqueProductsWishlisted,
        helper: "Distinct products saved by shoppers",
      },
      {
        title: "Back-in-Stock Leads",
        value: stats.totalBackInStockSubscribers,
        helper: "Total subscriptions collected",
      },
      {
        title: "Active Alert Subscribers",
        value: stats.activeBackInStockSubscribers,
        helper: "Still waiting for stock alerts",
      },
    ],
    [stats]
  );

  return (
    <Page
      title="Wishlist & Back-in-Stock"
      subtitle="Track buyer intent, demand, and restock subscribers."
      primaryAction={{ content: "Refresh", onAction: loadData }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {pageError ? (
              <Banner tone="critical" title="Something went wrong">
                <p>{pageError}</p>
              </Banner>
            ) : null}

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <InlineStack align="space-between" wrap gap="300">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingLg">
                      Filters
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Filter analytics and records by shop or product.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="200">
                    <Button variant="primary" onClick={loadData}>
                      Apply
                    </Button>
                    <Button
                      onClick={() => {
                        setShopFilter("");
                        setProductIdFilter("");
                      }}
                    >
                      Reset
                    </Button>
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
                  <TextField
                    label="Shop"
                    value={shopFilter}
                    onChange={setShopFilter}
                    autoComplete="off"
                    placeholder="e.g. store.myshopify.com"
                  />
                  <TextField
                    label="Product ID"
                    value={productIdFilter}
                    onChange={setProductIdFilter}
                    autoComplete="off"
                    placeholder="e.g. 123456789"
                  />
                </div>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <InlineStack align="space-between" wrap gap="300">
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingLg">
                      Overview
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Buyer intent and restock demand at a glance.
                    </Text>
                  </BlockStack>
                </InlineStack>

                {loading ? (
                  <Box padding="600">
                    <InlineStack align="center">
                      <Spinner size="large" />
                    </InlineStack>
                  </Box>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {cards.map((card) => (
                      <StatCard
                        key={card.title}
                        title={card.title}
                        value={card.value}
                        helper={card.helper}
                      />
                    ))}
                  </div>
                )}
              </BlockStack>
            </Card>

            {loading ? (
              <Card>
                <Box padding="600">
                  <InlineStack align="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              </Card>
            ) : (
              <>
                <DataCard
                  title="Recent Wishlist Saves"
                  items={wishlistItems}
                  emptyText="No wishlist items found for current filters."
                  renderItem={(item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 16,
                        background: "#fff",
                      }}
                    >
                      <BlockStack gap="150">
                        <InlineStack align="space-between" wrap gap="200">
                          <Text as="h3" variant="headingSm">
                            {item.productTitle || "Untitled Product"}
                          </Text>
                          <Badge tone="info">{item.ownerType}</Badge>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Product ID: {item.productId} · Variant: {item.variantId || "-"}
                        </Text>
                        <Text as="p" variant="bodySm">
                          Owner: {item.customerEmail || item.customerId || item.sessionId || "-"}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Saved on {formatDate(item.createdAt)}
                        </Text>
                      </BlockStack>
                    </div>
                  )}
                />

                <DataCard
                  title="Active Back-in-Stock Subscribers"
                  items={backInStockItems}
                  emptyText="No active back-in-stock subscribers found."
                  renderItem={(item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: 16,
                        background: "#fff",
                      }}
                    >
                      <BlockStack gap="150">
                        <InlineStack align="space-between" wrap gap="200">
                          <Text as="h3" variant="headingSm">
                            {item.productTitle || "Untitled Product"}
                          </Text>
                          <Badge tone={item.isActive ? "success" : "attention"}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Product ID: {item.productId} · Variant: {item.variantId || "-"}
                        </Text>
                        <Text as="p" variant="bodySm">
                          Customer: {item.customerName || "-"} · {item.customerEmail}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Subscribed on {formatDate(item.createdAt)}
                        </Text>
                      </BlockStack>
                    </div>
                  )}
                />
              </>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

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

const GET_LOYALTY_STATS = `
  query GetLoyaltyStats($shop: String) {
    loyaltyStats(shop: $shop) {
      success
      message
      data {
        totalMembers
        activePointHolders
        totalPointsIssued
        totalPointsRedeemed
        totalReferralInvites
        convertedReferrals
      }
    }
  }
`;

const GET_LOYALTY_CUSTOMERS = `
  query GetLoyaltyCustomers($shop: String, $search: String) {
    loyaltyCustomers(shop: $shop, search: $search) {
      success
      message
      count
      data {
        id
        shop
        customerEmail
        firstName
        lastName
        pointsBalance
        lifetimePointsEarned
        lifetimePointsRedeemed
        tier
        referralCode
        createdAt
      }
    }
  }
`;

const GET_REDEMPTIONS = `
  query GetRewardRedemptions($shop: String) {
    rewardRedemptions(shop: $shop) {
      success
      message
      count
      data {
        id
        rewardTitle
        rewardType
        pointsUsed
        rewardCode
        status
        createdAt
      }
    }
  }
`;

const GET_REFERRALS = `
  query GetReferralInvites($shop: String) {
    referralInvites(shop: $shop) {
      success
      message
      count
      data {
        id
        referredEmail
        referralCode
        status
        rewardPoints
        createdAt
      }
    }
  }
`;

const ADD_MANUAL_POINTS = `
  mutation AddManualLoyaltyPoints($input: ManualPointsInput!) {
    addManualLoyaltyPoints(input: $input) {
      success
      message
      data {
        id
        customerEmail
        pointsBalance
        tier
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
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
        minHeight: 110,
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

export default function LoyaltyPage() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const [shopFilter, setShopFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [manualPoints, setManualPoints] = useState("50");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [stats, setStats] = useState({
    totalMembers: 0,
    activePointHolders: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    totalReferralInvites: 0,
    convertedReferrals: 0,
  });

  const [customers, setCustomers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPageError("");

      const [statsData, customersData, redemptionsData, referralsData] =
        await Promise.all([
          graphqlRequest(GET_LOYALTY_STATS, { shop: shopFilter || null }),
          graphqlRequest(GET_LOYALTY_CUSTOMERS, {
            shop: shopFilter || null,
            search: searchFilter || null,
          }),
          graphqlRequest(GET_REDEMPTIONS, { shop: shopFilter || null }),
          graphqlRequest(GET_REFERRALS, { shop: shopFilter || null }),
        ]);

      setStats(
        statsData?.loyaltyStats?.data || {
          totalMembers: 0,
          activePointHolders: 0,
          totalPointsIssued: 0,
          totalPointsRedeemed: 0,
          totalReferralInvites: 0,
          convertedReferrals: 0,
        }
      );

      setCustomers(customersData?.loyaltyCustomers?.data || []);
      setRedemptions(redemptionsData?.rewardRedemptions?.data || []);
      setReferrals(referralsData?.referralInvites?.data || []);
    } catch (error) {
      setPageError(error.message || "Failed to load loyalty data");
    } finally {
      setLoading(false);
    }
  }, [shopFilter, searchFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statCards = useMemo(
    () => [
      {
        title: "Members",
        value: stats.totalMembers,
        helper: "Total loyalty customers",
      },
      {
        title: "Point Holders",
        value: stats.activePointHolders,
        helper: "Customers with active balance",
      },
      {
        title: "Points Issued",
        value: stats.totalPointsIssued,
        helper: "Lifetime points granted",
      },
      {
        title: "Points Redeemed",
        value: stats.totalPointsRedeemed,
        helper: "Points converted into rewards",
      },
      {
        title: "Referral Invites",
        value: stats.totalReferralInvites,
        helper: "Total referral attempts",
      },
      {
        title: "Converted Referrals",
        value: stats.convertedReferrals,
        helper: "Successful referral orders",
      },
    ],
    [stats]
  );

  const handleManualPoints = async () => {
    try {
      if (!selectedCustomerId || !manualPoints) {
        setPageError("Please select customer id and points value");
        return;
      }

      setActionLoading(true);
      setPageError("");
      setPageMessage("");

      const data = await graphqlRequest(ADD_MANUAL_POINTS, {
        input: {
          customerId: selectedCustomerId,
          points: Number(manualPoints),
          note: "Manual points from admin dashboard",
        },
      });

      if (!data?.addManualLoyaltyPoints?.success) {
        throw new Error(data?.addManualLoyaltyPoints?.message || "Failed to add points");
      }

      setPageMessage("Manual points added successfully.");
      await loadData();
    } catch (error) {
      setPageError(error.message || "Failed to add points");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Page
      title="Loyalty, Rewards & Referrals"
      subtitle="Repeat purchase, retention, and customer reward system."
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
                      Filters
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Filter loyalty analytics by shop and search members by email or code.
                    </Text>
                  </BlockStack>

                  <InlineStack gap="200">
                    <Button variant="primary" onClick={loadData}>
                      Apply
                    </Button>
                    <Button
                      onClick={() => {
                        setShopFilter("");
                        setSearchFilter("");
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
                    placeholder="store.myshopify.com"
                  />
                  <TextField
                    label="Search"
                    value={searchFilter}
                    onChange={setSearchFilter}
                    autoComplete="off"
                    placeholder="email / name / referral code"
                  />
                </div>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Overview
                </Text>

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
                    {statCards.map((card) => (
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

            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Manual Point Credit
                </Text>
                <Divider />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  <TextField
                    label="Customer ID"
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    autoComplete="off"
                    placeholder="Paste loyalty customer id"
                  />
                  <TextField
                    label="Points"
                    type="number"
                    value={manualPoints}
                    onChange={setManualPoints}
                    autoComplete="off"
                  />
                </div>

                <InlineStack>
                  <Button
                    variant="primary"
                    loading={actionLoading}
                    onClick={handleManualPoints}
                  >
                    Add points
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <InlineStack align="space-between" wrap gap="300">
                  <Text as="h2" variant="headingMd">
                    Loyalty Members
                  </Text>
                  <Badge tone={customers.length ? "success" : "attention"}>
                    {customers.length} items
                  </Badge>
                </InlineStack>
                <Divider />

                {loading ? (
                  <Box padding="600">
                    <InlineStack align="center">
                      <Spinner size="large" />
                    </InlineStack>
                  </Box>
                ) : !customers.length ? (
                  <EmptyState
                    heading="No loyalty members found"
                    image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                  >
                    <p>Customers will appear here when they join the loyalty program.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {customers.map((item) => (
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
                              {item.customerEmail || "Guest member"}
                            </Text>
                            <InlineStack gap="200">
                              <Badge tone="info">{item.tier}</Badge>
                              <Badge tone="success">{item.pointsBalance} pts</Badge>
                            </InlineStack>
                          </InlineStack>

                          <Text as="p" variant="bodySm" tone="subdued">
                            Referral Code: {item.referralCode}
                          </Text>
                          <Text as="p" variant="bodySm">
                            Earned: {item.lifetimePointsEarned} · Redeemed:{" "}
                            {item.lifetimePointsRedeemed}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Joined on {formatDate(item.createdAt)}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Customer ID: {item.id}
                          </Text>
                        </BlockStack>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <InlineStack align="space-between" wrap gap="300">
                  <Text as="h2" variant="headingMd">
                    Reward Redemptions
                  </Text>
                  <Badge tone={redemptions.length ? "success" : "attention"}>
                    {redemptions.length} items
                  </Badge>
                </InlineStack>
                <Divider />

                {!redemptions.length ? (
                  <EmptyState
                    heading="No redemptions yet"
                    image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                  >
                    <p>Reward redemption history will appear here.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {redemptions.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 16,
                          background: "#fff",
                        }}
                      >
                        <InlineStack align="space-between" wrap gap="200">
                          <BlockStack gap="050">
                            <Text as="h3" variant="headingSm">
                              {item.rewardTitle}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {item.pointsUsed} points used · {item.rewardType}
                            </Text>
                            <Text as="p" variant="bodySm">
                              Coupon: {item.rewardCode || "-"}
                            </Text>
                          </BlockStack>
                          <Badge tone="success">{item.status}</Badge>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <InlineStack align="space-between" wrap gap="300">
                  <Text as="h2" variant="headingMd">
                    Referrals
                  </Text>
                  <Badge tone={referrals.length ? "success" : "attention"}>
                    {referrals.length} items
                  </Badge>
                </InlineStack>
                <Divider />

                {!referrals.length ? (
                  <EmptyState
                    heading="No referrals yet"
                    image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
                  >
                    <p>Referral invite and conversion history will appear here.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {referrals.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 16,
                          background: "#fff",
                        }}
                      >
                        <InlineStack align="space-between" wrap gap="200">
                          <BlockStack gap="050">
                            <Text as="h3" variant="headingSm">
                              {item.referredEmail}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Code: {item.referralCode}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Reward Points: {item.rewardPoints}
                            </Text>
                          </BlockStack>
                          <Badge tone={item.status === "converted" ? "success" : "attention"}>
                            {item.status}
                          </Badge>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

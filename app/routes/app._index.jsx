/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import {
  Page,
  Card,
  Text,
  Badge,
  Banner,
  BlockStack,
  InlineStack,
  Spinner,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getWidgetsData } from "../lib/widgets.server";
import "../components/home-dashboard.css";

const GRAPHQL_ENDPOINT = "/graphql";

const HOME_DASHBOARD_QUERY = `
  query HomeDashboard {
    reviews {
      success
      count
      data {
        id
        reviewType
        rating
        status
        isPinned
        helpfulCount
        reviewImages
        reviewVideoUrl
        reviewYoutubeUrl
        createdAt
      }
    }
    wishlistStats {
      success
      data {
        totalWishlistItems
        uniqueProductsWishlisted
        totalBackInStockSubscribers
        activeBackInStockSubscribers
      }
    }
    loyaltyStats {
      success
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

export const loader = async ({ request }) => {
  return await getWidgetsData(request);
};

async function graphqlRequest(query) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
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

function parseReviewImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

function hasMedia(review) {
  return (
    parseReviewImages(review.reviewImages).length > 0 ||
    Boolean(review.reviewVideoUrl) ||
    Boolean(review.reviewYoutubeUrl)
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function KpiCard({ label, value, helper, tone = "green" }) {
  return (
    <div className={`home-kpi home-kpi--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </div>
  );
}

function SegmentBar({ segments }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="home-segment">
      <div className="home-segment__track">
        {segments.map((segment) => (
          <i
            key={segment.label}
            className={`home-segment__fill home-segment__fill--${segment.tone}`}
            style={{ width: `${total ? (segment.value / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="home-segment__legend">
        {segments.map((segment) => (
          <span key={segment.label}>
            <i className={`home-segment__dot home-segment__dot--${segment.tone}`} />
            {segment.label} {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="home-bars">
      {items.map((item) => (
        <div className="home-bars__row" key={item.label}>
          <span>{item.label}</span>
          <div>
            <i style={{ width: `${(item.value / maxValue) * 100}%` }} />
          </div>
          <strong>{formatNumber(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function Donut({ value, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div
      className="home-donut"
      style={{ "--donut-value": `${safeValue}%` }}
      aria-label={`${label}: ${safeValue}%`}
    >
      <strong>{safeValue}%</strong>
      <span>{label}</span>
    </div>
  );
}

export default function Index() {
  const { widgets = [] } = useLoaderData() || {};
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [dashboardData, setDashboardData] = useState({
    reviews: [],
    wishlistStats: null,
    loyaltyStats: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setPageError("");

        const data = await graphqlRequest(HOME_DASHBOARD_QUERY);

        if (!mounted) return;

        setDashboardData({
          reviews: data?.reviews?.data || [],
          wishlistStats: data?.wishlistStats?.data || null,
          loyaltyStats: data?.loyaltyStats?.data || null,
        });
      } catch (error) {
        if (mounted) setPageError(error.message || "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const overview = useMemo(() => {
    const reviews = dashboardData.reviews;
    const wishlist = dashboardData.wishlistStats || {
      totalWishlistItems: 0,
      uniqueProductsWishlisted: 0,
      totalBackInStockSubscribers: 0,
      activeBackInStockSubscribers: 0,
    };
    const loyalty = dashboardData.loyaltyStats || {
      totalMembers: 0,
      activePointHolders: 0,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0,
      totalReferralInvites: 0,
      convertedReferrals: 0,
    };

    const totalReviews = reviews.length;
    const approvedReviews = reviews.filter((review) => review.status === "approved").length;
    const pendingReviews = reviews.filter((review) => review.status === "pending").length;
    const rejectedReviews = reviews.filter((review) => review.status === "rejected").length;
    const mediaReviews = reviews.filter(hasMedia).length;
    const pinnedReviews = reviews.filter((review) => Boolean(review.isPinned)).length;
    const averageRating =
      totalReviews > 0
        ? (
            reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
            totalReviews
          ).toFixed(1)
        : "0.0";

    const reviewTypes = {
      product: reviews.filter((review) => normalizeReviewType(review.reviewType) === "product")
        .length,
      collection: reviews.filter(
        (review) => normalizeReviewType(review.reviewType) === "collection"
      ).length,
      store: reviews.filter((review) => normalizeReviewType(review.reviewType) === "store")
        .length,
    };

    const ratingBuckets = [5, 4, 3, 2, 1].map((rating) => ({
      label: `${rating} star`,
      value: reviews.filter((review) => Number(review.rating || 0) === rating).length,
    }));

    const installedWidgets = widgets.filter((widget) => widget.installed).length;
    const widgetInstallRate = widgets.length
      ? Math.round((installedWidgets / widgets.length) * 100)
      : 0;
    const approvalRate = totalReviews
      ? Math.round((approvedReviews / totalReviews) * 100)
      : 0;
    const referralConversionRate = loyalty.totalReferralInvites
      ? Math.round((loyalty.convertedReferrals / loyalty.totalReferralInvites) * 100)
      : 0;

    return {
      totalReviews,
      approvedReviews,
      pendingReviews,
      rejectedReviews,
      mediaReviews,
      pinnedReviews,
      averageRating,
      reviewTypes,
      ratingBuckets,
      wishlist,
      loyalty,
      installedWidgets,
      totalWidgets: widgets.length,
      widgetInstallRate,
      approvalRate,
      referralConversionRate,
    };
  }, [dashboardData, widgets]);

  const appMix = [
    { label: "Reviews", value: overview.totalReviews },
    { label: "Wishlist", value: overview.wishlist.totalWishlistItems },
    { label: "Back in stock", value: overview.wishlist.totalBackInStockSubscribers },
    { label: "Loyalty members", value: overview.loyalty.totalMembers },
    { label: "Referrals", value: overview.loyalty.totalReferralInvites },
  ];

  return (
    <Page fullWidth>
      <div className="home-dashboard">
        {pageError ? (
          <Banner tone="critical" title="Dashboard data unavailable">
            <p>{pageError}</p>
          </Banner>
        ) : null}

        <section className="home-hero">
          <div>
            <span className="home-eyebrow">subscription-features-wise</span>
            <h1>Complete app overview</h1>
            <p>
              Reviews, wishlist, back-in-stock, loyalty, referrals, and storefront widgets
              in one premium command dashboard.
            </p>
          </div>

          <div className="home-hero__health">
            {loading ? (
              <InlineStack align="center">
                <Spinner size="small" />
              </InlineStack>
            ) : (
              <>
                <Donut value={overview.approvalRate} label="review approval" />
                <Donut value={overview.widgetInstallRate} label="widget install" />
              </>
            )}
          </div>
        </section>

        <section className="home-kpi-grid">
          <KpiCard
            label="Total reviews"
            value={formatNumber(overview.totalReviews)}
            helper={`${overview.averageRating}/5 average rating`}
            tone="blue"
          />
          <KpiCard
            label="Wishlist items"
            value={formatNumber(overview.wishlist.totalWishlistItems)}
            helper={`${overview.wishlist.uniqueProductsWishlisted} unique products`}
            tone="green"
          />
          <KpiCard
            label="Back-in-stock"
            value={formatNumber(overview.wishlist.activeBackInStockSubscribers)}
            helper={`${overview.wishlist.totalBackInStockSubscribers} total subscribers`}
            tone="amber"
          />
          <KpiCard
            label="Loyalty members"
            value={formatNumber(overview.loyalty.totalMembers)}
            helper={`${overview.loyalty.activePointHolders} active point holders`}
            tone="violet"
          />
          <KpiCard
            label="Points issued"
            value={formatNumber(overview.loyalty.totalPointsIssued)}
            helper={`${formatNumber(overview.loyalty.totalPointsRedeemed)} redeemed`}
            tone="slate"
          />
          <KpiCard
            label="Widgets live"
            value={`${overview.installedWidgets}/${overview.totalWidgets}`}
            helper="Installed storefront widgets"
            tone="green"
          />
        </section>

        <section className="home-graph-grid">
          <Card roundedAbove="sm">
            <div className="home-panel">
              <BlockStack gap="300">
                <div className="home-panel__head">
                  <Text as="h2" variant="headingMd">
                    App Activity Mix
                  </Text>
                  <Badge tone="info">Live data</Badge>
                </div>
                <BarChart items={appMix} />
              </BlockStack>
            </div>
          </Card>

          <Card roundedAbove="sm">
            <div className="home-panel">
              <BlockStack gap="300">
                <div className="home-panel__head">
                  <Text as="h2" variant="headingMd">
                    Review Moderation
                  </Text>
                  <Badge tone={overview.pendingReviews ? "attention" : "success"}>
                    {overview.pendingReviews} pending
                  </Badge>
                </div>
                <SegmentBar
                  segments={[
                    { label: "Approved", value: overview.approvedReviews, tone: "green" },
                    { label: "Pending", value: overview.pendingReviews, tone: "amber" },
                    { label: "Rejected", value: overview.rejectedReviews, tone: "red" },
                  ]}
                />
              </BlockStack>
            </div>
          </Card>

          <Card roundedAbove="sm">
            <div className="home-panel">
              <BlockStack gap="300">
                <div className="home-panel__head">
                  <Text as="h2" variant="headingMd">
                    Rating Quality
                  </Text>
                  <Badge tone="success">{overview.averageRating}/5</Badge>
                </div>
                <BarChart items={overview.ratingBuckets} />
              </BlockStack>
            </div>
          </Card>

          <Card roundedAbove="sm">
            <div className="home-panel">
              <BlockStack gap="300">
                <div className="home-panel__head">
                  <Text as="h2" variant="headingMd">
                    Review Types
                  </Text>
                  <Badge tone="info">{overview.mediaReviews} media</Badge>
                </div>
                <SegmentBar
                  segments={[
                    { label: "Product", value: overview.reviewTypes.product, tone: "blue" },
                    { label: "Collection", value: overview.reviewTypes.collection, tone: "amber" },
                    { label: "Store", value: overview.reviewTypes.store, tone: "violet" },
                  ]}
                />
              </BlockStack>
            </div>
          </Card>

          <Card roundedAbove="sm">
            <div className="home-panel">
              <BlockStack gap="300">
                <div className="home-panel__head">
                  <Text as="h2" variant="headingMd">
                    Loyalty Economy
                  </Text>
                  <Badge tone="success">{overview.referralConversionRate}% referrals</Badge>
                </div>
                <BarChart
                  items={[
                    { label: "Members", value: overview.loyalty.totalMembers },
                    { label: "Point holders", value: overview.loyalty.activePointHolders },
                    { label: "Issued", value: overview.loyalty.totalPointsIssued },
                    { label: "Redeemed", value: overview.loyalty.totalPointsRedeemed },
                    { label: "Referrals", value: overview.loyalty.totalReferralInvites },
                    { label: "Converted", value: overview.loyalty.convertedReferrals },
                  ]}
                />
              </BlockStack>
            </div>
          </Card>

          <Card roundedAbove="sm">
            <div className="home-panel">
              <BlockStack gap="300">
                <div className="home-panel__head">
                  <Text as="h2" variant="headingMd">
                    Widget Coverage
                  </Text>
                  <Badge tone={overview.widgetInstallRate === 100 ? "success" : "attention"}>
                    {overview.widgetInstallRate}%
                  </Badge>
                </div>
                <BarChart
                  items={[
                    { label: "Installed", value: overview.installedWidgets },
                    { label: "Available", value: overview.totalWidgets },
                    { label: "Pinned reviews", value: overview.pinnedReviews },
                    { label: "Media reviews", value: overview.mediaReviews },
                  ]}
                />
              </BlockStack>
            </div>
          </Card>
        </section>
      </div>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

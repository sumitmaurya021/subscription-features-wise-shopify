/* eslint-disable react/prop-types */
import PlanCard from "./PlanCard";
import { Page } from "@shopify/polaris";
import "./subscription.css";

const WIDGET_CATALOG = [
  {
    handle: "product-reviews",
    title: "Write Reviews",
    group: "Review capture",
  },
  {
    handle: "star-rating-badge",
    title: "Star Ratings",
    group: "Trust badges",
  },
  {
    handle: "collection-star-rating-badges",
    title: "Collection Star Ratings",
    group: "Trust badges",
  },
  {
    handle: "review-snippets",
    title: "Review Snippets",
    group: "Review display",
  },
  {
    handle: "product-wishlist",
    title: "Product Wishlist",
    group: "Wishlist",
  },
  {
    handle: "reviews-grid",
    title: "Reviews Grid",
    group: "Review display",
  },
  {
    handle: "review-cards-carousel",
    title: "Cards Carousel",
    group: "Review display",
  },
  {
    handle: "reviews-carousel-classic",
    title: "Reviews Carousel Classic",
    group: "Review display",
  },
  {
    handle: "happy-coustomers-reviews",
    title: "Happy Customers Reviews",
    group: "Social proof",
  },
  {
    handle: "floating-reviews-tab",
    title: "Floating Reviews Tab",
    group: "Social proof",
  },
  {
    handle: "popup-reviews",
    title: "Pop-up Reviews",
    group: "Social proof",
  },
  {
    handle: "testimonials-carousel",
    title: "Testimonials Carousel",
    group: "Social proof",
  },
  {
    handle: "video-reviews-carousel",
    title: "Videos Carousel",
    group: "Media reviews",
  },
  {
    handle: "product-loyalty",
    title: "Product Loyalty",
    group: "Loyalty",
  },
];

const plans = [
  {
    name: "BASIC",
    price: 3000,
    eyebrow: "Launch",
    description: "Essential review and wishlist widgets for a clean product page setup.",
    includedHandles: [
      "product-reviews",
      "star-rating-badge",
      "collection-star-rating-badges",
      "review-snippets",
      "product-wishlist",
    ],
    perks: ["14-day trial", "Core reviews", "Wishlist ready"],
    isCurrentPlan: true,
    tone: "basic",
  },
  {
    name: "ADVANCED",
    price: 5000,
    eyebrow: "Scale",
    description: "Adds high-conversion review layouts, popups, and storefront proof widgets.",
    includedHandles: [
      "product-reviews",
      "star-rating-badge",
      "collection-star-rating-badges",
      "review-snippets",
      "product-wishlist",
      "reviews-grid",
      "review-cards-carousel",
      "reviews-carousel-classic",
      "happy-coustomers-reviews",
      "floating-reviews-tab",
      "popup-reviews",
    ],
    perks: ["14-day trial", "Review layouts", "Popup proof"],
    isPopular: true,
    tone: "advanced",
  },
  {
    name: "PLUS",
    price: 10000,
    eyebrow: "Premium",
    description: "Complete widget suite with video reviews, testimonials, and loyalty tools.",
    includedHandles: "all",
    perks: ["14-day trial", "All widgets", "Loyalty suite"],
    tone: "plus",
  },
];

async function subscribe(plan) {
  const res = await fetch(`/api/billing/create?plan=${plan}`, {
    method: "POST",
  });

  const data = await res.json();

  if (data.confirmationUrl) {
    window.top.location.href = data.confirmationUrl;
  }
}

function buildCatalog(widgets) {
  const catalogMap = new Map(
    WIDGET_CATALOG.map((widget) => [widget.handle, widget])
  );

  widgets.forEach((widget) => {
    const handle = widget.handle || widget.id;

    if (!handle) return;

    const fallback = catalogMap.get(handle) || {};

    catalogMap.set(handle, {
      handle,
      title: widget.title || fallback.title || handle,
      group: fallback.group || "Storefront widget",
    });
  });

  return Array.from(catalogMap.values());
}

function getIncludedHandles(plan, catalog) {
  if (plan.includedHandles === "all") {
    return catalog.map((widget) => widget.handle);
  }

  return plan.includedHandles;
}

function buildFeatures(catalog, includedHandles) {
  const includedSet = new Set(includedHandles);

  return catalog.map((widget) => ({
    label: widget.title,
    group: widget.group,
    available: includedSet.has(widget.handle),
  }));
}

export default function Subscription({ widgets = [] }) {
  const widgetCatalog = buildCatalog(widgets);
  const totalWidgets = widgetCatalog.length;

  const planCards = plans.map((plan) => {
    const includedHandles = getIncludedHandles(plan, widgetCatalog);

    return {
      ...plan,
      features: buildFeatures(widgetCatalog, includedHandles),
      widgetCount: includedHandles.length,
      totalWidgets,
    };
  });

  return (
    <Page fullWidth>
      <div className="pricing-shell">
        <section className="pricing-hero">
          <div className="pricing-hero__copy">
            <span className="pricing-eyebrow">Subscription Plans</span>
            <h1>Premium widget bundles for your Shopify app</h1>
            <p>
              Plans are mapped to the actual storefront widgets in this app:
              reviews, wishlist, social proof, video reviews, and loyalty.
            </p>
          </div>

          <div className="pricing-hero__stats" aria-label="Widget summary">
            <div>
              <strong>{totalWidgets}</strong>
              <span>widgets</span>
            </div>
            <div>
              <strong>3</strong>
              <span>growth modules</span>
            </div>
            <div>
              <strong>14</strong>
              <span>day trial</span>
            </div>
          </div>
        </section>

        <section className="pricing-grid" aria-label="Subscription plan cards">
          {planCards.map((plan) => (
            <PlanCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              eyebrow={plan.eyebrow}
              description={plan.description}
              perks={plan.perks}
              features={plan.features}
              widgetCount={plan.widgetCount}
              totalWidgets={plan.totalWidgets}
              isPopular={plan.isPopular}
              isCurrentPlan={plan.isCurrentPlan}
              tone={plan.tone}
              onSubscribe={() => subscribe(plan.name)}
            />
          ))}
        </section>
      </div>
    </Page>
  );
}

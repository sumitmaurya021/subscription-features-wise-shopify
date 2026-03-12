import PlanCard from "./PlanCard";
import { Page, Grid } from "@shopify/polaris";

const plans = [
  {
    name: "BASIC",
    price: "3,000",
    isCurrentPlan: true,
    features: [
      { label: "14 Day Trial", available: true },
      { label: "20+ option types", available: true },
      { label: "Option set", available: true },
      { label: "Price add-ons", available: true },
      { label: "Condition", available: true },
      { label: "File upload (20M / Up to 10 files)", available: true },
      { label: "Custom CSS", available: true },
      { label: "Order limit", available: false },
      { label: "Negative price", available: false },
      { label: "Sku", available: false },
      { label: "Weight", available: false },
      { label: "One time charge", available: false },
      { label: "Option value quantity", available: false },
      { label: "Font pick", available: false },
      { label: "Option group", available: false },
      { label: "ranslation", available: false },
      { label: "Country condition", available: false },
      { label: "Customer condition", available: false },
      { label: "Discount price", available: false },
      { label: "Market price", available: false },
      { label: "Price formula builder", available: false },
      { label: "Advanced pricing logic", available: false },
      { label: "Percentage price", available: false },
      { label: "Volume discount", available: false },
    ],
  },
  {
    name: "ADVANCED",
    price: "5,000",
    isPopular: true,
    features: [
      { label: "14 Day Trial", available: true },
      { label: "20+ option types", available: true },
      { label: "Option set", available: true },
      { label: "Price add-ons", available: true },
      { label: "Condition", available: true },
      { label: "File upload (20M / Up to 10 files)", available: true },
      { label: "Custom CSS", available: true },
      { label: "Order limit", available: true },
      { label: "Negative price", available: true },
      { label: "Sku", available: true },
      { label: "Weight", available: true },
      { label: "One time charge", available: true },
      { label: "Option value quantity", available: true },
      { label: "Font pick", available: true },
      { label: "Option group", available: true },
      { label: "ranslation", available: true },
      { label: "Country condition", available: true },
      { label: "Customer condition", available: false },
      { label: "Discount price", available: false },
      { label: "Market price", available: false },
      { label: "Price formula builder", available: false },
      { label: "Advanced pricing logic", available: false },
      { label: "Percentage price", available: false },
      { label: "Volume discount", available: false },
    ],
  },
  {
    name: "PLUS",
    price: "10,000",
    features: [
      { label: "14 Day Trial", available: true },
      { label: "20+ option types", available: true },
      { label: "Option set", available: true },
      { label: "Price add-ons", available: true },
      { label: "Condition", available: true },
      { label: "File upload (20M / Up to 10 files)", available: true },
      { label: "Custom CSS", available: true },
      { label: "Order limit", available: true },
      { label: "Negative price", available: true },
      { label: "Sku", available: true },
      { label: "Weight", available: true },
      { label: "One time charge", available: true },
      { label: "Option value quantity", available: true },
      { label: "Font pick", available: true },
      { label: "Option group", available: true },
      { label: "ranslation", available: true },
      { label: "Country condition", available: true },
      { label: "Customer condition", available: true },
      { label: "Discount price", available: true },
      { label: "Market price", available: true },
      { label: "Price formula builder", available: true },
      { label: "Advanced pricing logic", available: true },
      { label: "Percentage price", available: true },
      { label: "Volume discount", available: true },
    ],
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

export default function Subscription() {
  return (
    <Page title="Subscription Plans">
      <Grid>

        {plans.map((plan) => (
          <Grid.Cell
            key={plan.name}
            columnSpan={{
              xs: 12,
              sm: 6,
              md: 4,
              lg: 4,
            }}
          >
            <PlanCard
              name={plan.name}
              price={plan.price}
              features={plan.features}
              isPopular={plan.isPopular}
              isCurrentPlan={plan.isCurrentPlan}
              onSubscribe={() => subscribe(plan.name)}
            />
          </Grid.Cell>
        ))}

      </Grid>
    </Page>
  );
}

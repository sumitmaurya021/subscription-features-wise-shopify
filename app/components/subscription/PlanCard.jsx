import {
  Card,
  Text,
  Button,
  Badge,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";

export default function PlanCard({
  name,
  price,
  features,
  isPopular,
  isCurrentPlan,
  onSubscribe,
}) {

  return (
    <div
      style={{
        height: "100%",
        position: "relative",
      }}
    >
      {isPopular && (
        <div
          style={{
            position: "absolute",
            top: "-12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            padding: "4px 8px",
            fontSize: "20px",
          }}
        >
          <Badge tone="success">Most popular</Badge>
        </div>
      )}

      <Card
        roundedAbove="sm"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          border: isPopular ? "2px solid #5c6ac4" : "1px solid #e1e3e5",
          boxShadow: isPopular
            ? "0 12px 30px rgba(92,106,196,0.25)"
            : "0 4px 10px rgba(0,0,0,0.05)",
          background: isPopular ? "#f4f6ff" : "white",
        }}
      >
        <BlockStack gap="400">

          <Text variant="headingLg" as="h2" alignment="center">
            {name}
          </Text>

          <InlineStack align="baseline" gap="100" align="center">
            <Text variant="heading2xl" as="p">
              ₹{price}
            </Text>

            <Text variant="bodySm" tone="subdued">
              /month
            </Text>
          </InlineStack>

          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
            }}
          >
            <BlockStack gap="100">
              {features.map((f, i) => (
                <InlineStack key={i} gap="200">
                  <Text tone={f.available ? "success" : "subdued"}>
                    {f.available ? "✔" : "✖"}
                  </Text>

                  <Text tone={!f.available ? "subdued" : ""}>
                    {f.label}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </div>

          <div style={{ marginTop: "auto" }}>
            <Button
              variant="primary"
              fullWidth
              size="large"
              disabled={isCurrentPlan}
              onClick={onSubscribe}
            >
              {isCurrentPlan ? "Current Plan ✓" : "Subscribe"}
            </Button>
          </div>

        </BlockStack>
      </Card>
    </div>
  );
}

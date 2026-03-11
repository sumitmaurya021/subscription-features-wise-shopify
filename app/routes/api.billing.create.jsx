import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {

  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");

  let price = 0;

  if (plan === "BASIC") price = 3000;
  if (plan === "ADVANCED") price = 5000;
  if (plan === "PLUS") price = 10000;

  const mutation = `
  mutation {
    appSubscriptionCreate(
      name: "${plan} Plan"
      returnUrl: "${process.env.SHOPIFY_APP_URL}/billing/confirm"
      test: true
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: ${price}, currencyCode: INR }
              interval: EVERY_30_DAYS
            }
          }
        }
      ]
    ) {
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
  `;

  const response = await admin.graphql(mutation);
  const data = await response.json();

  return json({
    confirmationUrl:
      data.data.appSubscriptionCreate.confirmationUrl,
  });
};

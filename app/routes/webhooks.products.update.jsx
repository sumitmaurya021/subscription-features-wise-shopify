import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    await authenticate.webhook(request);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("PRODUCTS UPDATE WEBHOOK ERROR:", error);
    return new Response("Webhook failed", { status: 500 });
  }
};

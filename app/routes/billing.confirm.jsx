import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {

  const { admin } = await authenticate.admin(request);

  const query = `
  {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();

  const subscriptions =
    data.data.currentAppInstallation.activeSubscriptions;

  if (subscriptions.length > 0) {
    const activePlan = subscriptions[0].name;

    console.log("Active plan:", activePlan);

    return redirect("/app");
  }

  return redirect("/subscription");
};

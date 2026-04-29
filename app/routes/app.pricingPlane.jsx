import { useLoaderData } from "react-router";
import Subscription from "../components/subscription/Subscription";
import { getWidgetsData } from "../lib/widgets.server";

export const loader = async ({ request }) => {
  return await getWidgetsData(request);
};

export default function PricingPlane() {
  const data = useLoaderData();

  return <Subscription widgets={data?.widgets || []} />;
}


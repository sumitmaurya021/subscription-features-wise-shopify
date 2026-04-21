import React from "react";
import { useLoaderData } from "react-router";
import Widgets from "../components/widgets/widgets";
import { getWidgetsData } from "../lib/widgets.server";

export const loader = async ({ request }) => {
  return await getWidgetsData(request);
};

export default function AppWidgets() {
  const data = useLoaderData();

  return <Widgets widgets={data.widgets} />;
}

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { sendBackInStockEmail } from "../utils/sendBackInStockEmail.server";

async function getVariantAndProductFromInventoryItem(admin, inventoryItemNumericId) {
  const inventoryItemGid = `gid://shopify/InventoryItem/${inventoryItemNumericId}`;

  const response = await admin.graphql(
    `#graphql
      query GetInventoryItem($id: ID!) {
        inventoryItem(id: $id) {
          id
          variant {
            id
            title
            inventoryQuantity
            product {
              id
              title
              handle
              featuredImage {
                url
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: inventoryItemGid,
      },
    }
  );

  const result = await response.json();
  const variant = result?.data?.inventoryItem?.variant;

  if (!variant) return null;

  return {
    variantId: String(variant.id).split("/").pop(),
    productId: String(variant.product?.id || "").split("/").pop(),
    productTitle: variant.product?.title || "",
    productHandle: variant.product?.handle || "",
    productImage: variant.product?.featuredImage?.url || "",
    inventoryQuantity: Number(variant.inventoryQuantity || 0),
  };
}

export const action = async ({ request }) => {
  try {
    const { topic, shop, admin, payload } = await authenticate.webhook(request);

    if (topic !== "INVENTORY_LEVELS_UPDATE") {
      return new Response("Unhandled topic", { status: 200 });
    }

    const inventoryItemId =
      payload?.inventory_item_id ||
      payload?.inventoryItemId ||
      payload?.inventory_item?.id;

    if (!inventoryItemId) {
      return new Response("No inventory item id", { status: 200 });
    }

    const mapped = await getVariantAndProductFromInventoryItem(admin, inventoryItemId);

    if (!mapped) {
      return new Response("No mapped variant found", { status: 200 });
    }

    if (mapped.inventoryQuantity <= 0) {
      return new Response("Inventory still unavailable", { status: 200 });
    }

    const activeRequests = await prisma.backInStockRequest.findMany({
      where: {
        shop,
        productId: String(mapped.productId),
        variantId: String(mapped.variantId || ""),
        isActive: true,
      },
    });

    for (const item of activeRequests) {
      const sendResult = await sendBackInStockEmail({
        to: item.customerEmail,
        customerName: item.customerName,
        productTitle: item.productTitle || mapped.productTitle,
        productUrl: item.productUrl || `/products/${mapped.productHandle}`,
        shop,
      });

      if (sendResult.success) {
        await prisma.backInStockRequest.update({
          where: { id: item.id },
          data: {
            isActive: false,
            notifiedAt: new Date(),
            productTitle: mapped.productTitle || item.productTitle,
            productHandle: mapped.productHandle || item.productHandle,
            productImage: mapped.productImage || item.productImage,
            productUrl: item.productUrl || `/products/${mapped.productHandle}`,
          },
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("INVENTORY WEBHOOK ERROR:", error);
    return new Response("Webhook failed", { status: 500 });
  }
};
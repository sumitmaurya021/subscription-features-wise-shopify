import { Resend } from "resend";

export async function sendBackInStockEmail({
  to,
  customerName,
  productTitle,
  productUrl,
  shop,
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.BACK_IN_STOCK_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    console.warn("Resend is not configured. Skipping email send.");
    return { success: false, message: "Email provider not configured" };
  }

  try {
    const resend = new Resend(resendApiKey);

    const safeName = customerName || "there";
    const safeProductTitle = productTitle || "your product";
    const safeUrl = productUrl
      ? productUrl.startsWith("http")
        ? productUrl
        : `https://${shop}${productUrl}`
      : `https://${shop}`;

    const response = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: `${safeProductTitle} is back in stock ✨`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Back in Stock</title>
          </head>
          <body style="margin:0; padding:0; background:#f4f7fb; font-family:Arial, Helvetica, sans-serif; color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb; margin:0; padding:0;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px rgba(17,24,39,0.08);">
                    
                    <tr>
                      <td style="background:linear-gradient(135deg, #111827 0%, #2563eb 100%); padding:28px 32px; text-align:center;">
                        <div style="display:inline-block; padding:8px 14px; border-radius:999px; background:rgba(255,255,255,0.12); color:#ffffff; font-size:12px; font-weight:700; letter-spacing:0.3px;">
                          BACK IN STOCK ALERT
                        </div>

                        <h1 style="margin:18px 0 8px; font-size:32px; line-height:1.2; color:#ffffff; font-weight:800;">
                          Good news, ${safeName} 👋
                        </h1>

                        <p style="margin:0; font-size:15px; line-height:1.6; color:rgba(255,255,255,0.88);">
                          One of the items you were waiting for is available again.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:36px 32px 20px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb; border-radius:20px; background:linear-gradient(180deg, #ffffff 0%, #f9fbff 100%);">
                          <tr>
                            <td style="padding:28px;">
                              <div style="font-size:13px; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:10px;">
                                Available Now
                              </div>

                              <h2 style="margin:0 0 12px; font-size:26px; line-height:1.3; color:#111827; font-weight:800;">
                                ${safeProductTitle}
                              </h2>

                              <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#4b5563;">
                                The product you showed interest in is now back in stock. 
                                Stocks can move quickly, so this is the best time to grab it before it sells out again.
                              </p>

                              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="center" style="border-radius:12px; background:linear-gradient(135deg, #111827 0%, #2563eb 100%);">
                                    <a
                                      href="${safeUrl}"
                                      style="display:inline-block; padding:14px 24px; font-size:15px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:12px;"
                                    >
                                      View Product
                                    </a>
                                  </td>
                                </tr>
                              </table>

                              <p style="margin:18px 0 0; font-size:13px; line-height:1.6; color:#6b7280;">
                                Tap the button above to see the product details and place your order.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 32px 28px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate; border-spacing:0;">
                          <tr>
                            <td style="padding:18px 20px; border:1px solid #e5e7eb; border-radius:16px; background:#f9fafb;">
                              <p style="margin:0; font-size:14px; line-height:1.7; color:#374151;">
                                <strong style="color:#111827;">Why you received this email:</strong><br/>
                                You subscribed for a back-in-stock alert for this product on <strong>${shop}</strong>.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 32px 32px; text-align:center;">
                        <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#6b7280;">
                          Thanks for staying with us.
                        </p>
                        <p style="margin:0; font-size:13px; line-height:1.6; color:#9ca3af;">
                          © ${new Date().getFullYear()} ${shop}
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (response?.error) {
      console.error("RESEND SEND ERROR:", response.error);
      return {
        success: false,
        message: response.error.message || "Failed to send email",
      };
    }

    console.log("BACK IN STOCK EMAIL SUCCESS:", response);

    return { success: true, data: response };
  } catch (error) {
    console.error("RESEND SEND ERROR:", error);
    return { success: false, message: "Failed to send email" };
  }
}
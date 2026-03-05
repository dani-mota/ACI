interface AccessRejectedParams {
  userName: string;
  rejectionReason?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAccessRejectedEmail({
  userName,
  rejectionReason,
}: AccessRejectedParams): { subject: string; html: string } {
  const subject = "ACI Access Request Update";
  const safeName = escapeHtml(userName);
  const safeReason = rejectionReason ? escapeHtml(rejectionReason) : undefined;

  const reasonBlock = safeReason
    ? `<p style="margin: 0 0 24px; font-size: 13px; color: #52525b; line-height: 1.7; background-color: #fafafa; border: 1px solid #e4e4e7; padding: 12px 16px;">
        <strong>Reason:</strong> ${safeReason}
      </p>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0a1628; padding: 24px 32px;">
              <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">ACI</span>
              <span style="color: #71717a; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-left: 8px;">Access Update</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px; font-size: 18px; color: #0a1628; font-weight: 700;">
                Hello ${safeName},
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #52525b; line-height: 1.6;">
                Thank you for your interest in the Arklight Cognitive Index platform. After reviewing your access request, we are unable to approve it at this time.
              </p>

              ${reasonBlock}

              <p style="margin: 0; font-size: 11px; color: #a1a1aa; line-height: 1.6;">
                If you believe this was in error or have questions, please contact us.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; border-top: 1px solid #e4e4e7; padding: 16px 32px;">
              <p style="margin: 0; font-size: 10px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;">
                Arklight Cognitive Index &bull; Powered by ACI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

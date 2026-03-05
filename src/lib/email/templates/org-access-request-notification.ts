interface OrgAccessRequestNotificationData {
  requesterName: string;
  requesterEmail: string;
  requesterJobTitle: string;
  requesterReason?: string;
  orgName: string;
  settingsUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOrgAccessRequestNotificationEmail(
  data: OrgAccessRequestNotificationData
): { subject: string; html: string } {
  const name = escapeHtml(data.requesterName);
  const email = escapeHtml(data.requesterEmail);
  const jobTitle = escapeHtml(data.requesterJobTitle);
  const reason = data.requesterReason ? escapeHtml(data.requesterReason) : "Not provided";
  const orgName = escapeHtml(data.orgName);
  const safeUrl = encodeURI(data.settingsUrl.trim());

  const subject = `New access request for ${data.orgName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0F1729;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F1729;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">ACI</p>
              <p style="margin:4px 0 0;font-size:10px;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Arklight Cognitive Index</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1E293B;border:1px solid #334155;padding:0;">

              <!-- Card Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:28px 32px 20px;">
                    <p style="margin:0;font-size:16px;font-weight:600;color:#ffffff;">New Access Request</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
                      ${name} has requested access to <strong style="color:#ffffff;">${orgName}</strong> on ACI.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #334155;">
                <tr>
                  <td style="padding:16px 32px;border-bottom:1px solid #334155;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:1px;color:#64748b;text-transform:uppercase;">Email</p>
                    <p style="margin:0;font-size:13px;color:#e2e8f0;">
                      <a href="mailto:${email}" style="color:#0EA5E9;text-decoration:none;">${email}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;border-bottom:1px solid #334155;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:1px;color:#64748b;text-transform:uppercase;">Job Title</p>
                    <p style="margin:0;font-size:13px;color:#e2e8f0;">${jobTitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:1px;color:#64748b;text-transform:uppercase;">Reason</p>
                    <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.5;">${reason}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #334155;">
                <tr>
                  <td style="padding:24px 32px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color:#0EA5E9;padding:0;">
                          <a href="${safeUrl}" style="display:inline-block;padding:10px 24px;font-size:13px;font-weight:600;color:#0F1729;text-decoration:none;letter-spacing:0.3px;">Review Request &rarr;</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;">
              <p style="margin:0;font-size:11px;color:#475569;line-height:1.5;">
                This notification was sent because you are a TA Leader for ${orgName} on ACI. Do not reply to this email.
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

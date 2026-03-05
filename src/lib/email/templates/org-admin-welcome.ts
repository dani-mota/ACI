interface OrgAdminWelcomeParams {
  adminName: string;
  orgName: string;
  setupUrl: string;
  loginUrl: string;
  roleNames: string[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOrgAdminWelcomeEmail({
  adminName,
  orgName,
  setupUrl,
  loginUrl,
  roleNames,
}: OrgAdminWelcomeParams): { subject: string; html: string } {
  const safeName = escapeHtml(adminName);
  const safeOrg = escapeHtml(orgName);
  const safeSetupUrl = encodeURI(setupUrl.trim());
  const safeLoginUrl = encodeURI(loginUrl.trim());

  const rolesListHtml = roleNames
    .map(
      (r) =>
        `<tr><td style="padding: 0 0 8px 16px; font-size: 13px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeHtml(r)}</td></tr>`
    )
    .join("\n");

  const subject = "Your ACI environment is ready";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #F1F5F9;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: #0F1729; padding: 28px 32px; border-radius: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <span style="color: #FFFFFF; font-size: 18px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">ACI</span>
                  </td>
                  <td align="right">
                    <span style="color: #64748B; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Environment Ready</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent line -->
          <tr>
            <td style="background-color: #0EA5E9; height: 3px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 32px 32px 0;">
              <p style="margin: 0 0 4px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Welcome
              </p>
              <h1 style="margin: 0 0 20px; font-size: 22px; color: #0F1729; font-weight: 700; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${safeName}
              </h1>
              <p style="margin: 0 0 28px; font-size: 14px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Your <strong style="color: #0F1729;">${safeOrg}</strong> environment on the Arklight Cognitive Index platform is ready. You've been set up as the primary administrator.
              </p>
            </td>
          </tr>

          <!-- Pre-configured roles -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Pre-Configured Roles</p>
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      ${rolesListHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next steps -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 24px 32px 0;">
              <p style="margin: 0 0 12px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Next Steps
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding: 0 0 10px 16px; font-size: 13px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">1. Set your password using the button below</td>
                </tr>
                <tr>
                  <td style="padding: 0 0 10px 16px; font-size: 13px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">2. Log in and review pre-configured assessment roles</td>
                </tr>
                <tr>
                  <td style="padding: 0 0 10px 16px; font-size: 13px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">3. Invite your team members</td>
                </tr>
                <tr>
                  <td style="padding: 0 0 10px 16px; font-size: 13px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">4. Send your first candidate assessment</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 28px 32px 32px;" align="center">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color: #0EA5E9; border-radius: 0;">
                    <a href="${safeSetupUrl}" target="_blank" style="display: inline-block; background-color: #0EA5E9; color: #FFFFFF; font-size: 12px; font-weight: 700; text-decoration: none; padding: 14px 40px; text-transform: uppercase; letter-spacing: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Set Up Your Account
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 0 32px 28px;">
              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                This setup link expires in <strong>24 hours</strong>. If it expires, use the
                <a href="${safeLoginUrl}" style="color: #64748B;">"Forgot password"</a>
                option on the login page.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F1729; padding: 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Arklight Cognitive Index
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin: 0; font-size: 9px; color: #475569; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Powered by ACI
                    </p>
                  </td>
                </tr>
              </table>
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

import { getRoleLabel } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";

interface TeamInviteParams {
  inviterName: string;
  inviterEmail: string;
  inviterRole: AppUserRole;
  orgName: string;
  role: AppUserRole;
  acceptUrl: string;
  expiresAt: Date;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ROLE_DESCRIPTIONS: Record<string, string[]> = {
  TA_LEADER: [
    "View full pipeline analytics and psychometric validity data",
    "Manage team access and invite new members",
    "Export comprehensive reports and audit trails",
  ],
  RECRUITING_MANAGER: [
    "Review candidate assessments with predictive insights",
    "Access red flags, intelligence reports, and candidate comparisons",
    "Export scorecards and share with hiring managers",
  ],
  HIRING_MANAGER: [
    "Review candidate profiles with construct-level breakdowns",
    "Access AI conversation transcripts and peer comparisons",
    "View one-page summaries shared by your recruiting team",
  ],
  RECRUITER_COORDINATOR: [
    "View candidate status and composite fit scores",
    "Access interview focus areas and development plans",
    "Coordinate the hiring pipeline with bulk actions",
  ],
  EXTERNAL_COLLABORATOR: [
    "View assigned candidate profiles and composite scores",
    "Access interview guides for your assigned candidates",
    "Review contact information and status updates",
  ],
};

export function buildTeamInviteEmail({
  inviterName,
  inviterEmail,
  inviterRole,
  orgName,
  role,
  acceptUrl,
  expiresAt,
}: TeamInviteParams): { subject: string; html: string } {
  const safeName = escapeHtml(inviterName);
  const safeEmail = escapeHtml(inviterEmail);
  const safeOrg = escapeHtml(orgName);
  const safeRole = escapeHtml(getRoleLabel(role));
  const safeInviterRole = escapeHtml(getRoleLabel(inviterRole));
  const safeUrl = encodeURI(acceptUrl.trim());
  const expiryStr = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const bullets = (ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS.RECRUITER_COORDINATOR)
    .map(
      (b) =>
        `<tr><td style="padding: 0 0 8px 16px; font-size: 13px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">&#8226; ${escapeHtml(b)}</td></tr>`
    )
    .join("\n");

  const subject = `${safeName} invited you to join ${safeOrg} on ACI`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #F1F5F9;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 560px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: #0F1729; padding: 28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <span style="color: #FFFFFF; font-size: 18px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">ACI</span>
                  </td>
                  <td align="right">
                    <span style="color: #64748B; font-size: 9px; text-transform: uppercase; letter-spacing: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Team Invitation</span>
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
                Invitation
              </p>
              <h1 style="margin: 0 0 20px; font-size: 22px; color: #0F1729; font-weight: 700; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Join ${safeOrg} on ACI
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #334155; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <strong style="color: #0F1729;">${safeName}</strong> (${safeInviterRole}) has invited you to join <strong style="color: #0F1729;">${safeOrg}</strong> on the Arklight Cognitive Index platform.
              </p>
            </td>
          </tr>

          <!-- Role details -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Your Role: ${safeRole}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      ${bullets}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 28px 32px 32px;" align="center">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background-color: #0EA5E9;">
                    <a href="${safeUrl}" target="_blank" style="display: inline-block; background-color: #0EA5E9; color: #FFFFFF; font-size: 12px; font-weight: 700; text-decoration: none; padding: 14px 40px; text-transform: uppercase; letter-spacing: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 0 32px 28px;">
              <p style="margin: 0 0 8px; font-size: 11px; color: #94A3B8; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                This invitation expires on <strong>${escapeHtml(expiryStr)}</strong>. You can sign in with your email/password or use Google/Microsoft SSO.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                If you have questions, contact ${safeName} at <a href="mailto:${safeEmail}" style="color: #64748B;">${safeEmail}</a>.
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

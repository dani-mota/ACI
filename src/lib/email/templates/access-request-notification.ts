interface AccessRequestNotificationData {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  requestedRole: string;
  submittedAt: string;
  adminUrl: string;
}

const ROLE_LABELS: Record<string, string> = {
  RECRUITER_COORDINATOR: "Recruiter",
  RECRUITING_MANAGER: "Recruiting Manager",
  HIRING_MANAGER: "Hiring Manager",
  TA_LEADER: "TA Leader",
};

export function accessRequestNotificationEmail(data: AccessRequestNotificationData): {
  subject: string;
  html: string;
} {
  const roleLabel = ROLE_LABELS[data.requestedRole] ?? data.requestedRole;

  const subject = `New Access Request: ${data.firstName} ${data.lastName} (${data.companyName})`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e4e9;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0a1628;padding:32px 40px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;color:#c9a84c;text-transform:uppercase;">Arklight Cognitive Index</p>
              <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;">New Access Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;">
                Someone has submitted a request to join the ACI platform. Review the details below and approve or reject from the admin panel.
              </p>

              <!-- Details table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e4e9;margin-bottom:32px;">
                <tr>
                  <td style="padding:12px 16px;background-color:#f8f9fb;border-bottom:1px solid #e2e4e9;font-size:11px;font-weight:600;letter-spacing:1px;color:#6b7280;text-transform:uppercase;width:36%;">Name</td>
                  <td style="padding:12px 16px;background-color:#f8f9fb;border-bottom:1px solid #e2e4e9;font-size:14px;color:#111827;">${data.firstName} ${data.lastName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e4e9;font-size:11px;font-weight:600;letter-spacing:1px;color:#6b7280;text-transform:uppercase;">Email</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e4e9;font-size:14px;color:#111827;">
                    <a href="mailto:${data.email}" style="color:#0a1628;text-decoration:none;">${data.email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background-color:#f8f9fb;border-bottom:1px solid #e2e4e9;font-size:11px;font-weight:600;letter-spacing:1px;color:#6b7280;text-transform:uppercase;">Organization</td>
                  <td style="padding:12px 16px;background-color:#f8f9fb;border-bottom:1px solid #e2e4e9;font-size:14px;color:#111827;">${data.companyName}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e4e9;font-size:11px;font-weight:600;letter-spacing:1px;color:#6b7280;text-transform:uppercase;">Requested Role</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e2e4e9;font-size:14px;color:#111827;">${roleLabel}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background-color:#f8f9fb;font-size:11px;font-weight:600;letter-spacing:1px;color:#6b7280;text-transform:uppercase;">Submitted</td>
                  <td style="padding:12px 16px;background-color:#f8f9fb;font-size:14px;color:#111827;">${data.submittedAt}</td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#c9a84c;padding:0;">
                    <a href="${data.adminUrl}" style="display:inline-block;padding:12px 28px;font-size:13px;font-weight:600;color:#0a1628;text-decoration:none;letter-spacing:0.5px;">Review Request &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e2e4e9;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                This notification was sent automatically by the ACI platform. Do not reply to this email.
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

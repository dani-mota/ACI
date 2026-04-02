interface ResultsEmailParams {
  candidateName: string;
  roleName: string;
  companyName: string;
  cognitivePercentile: number;
  technicalPercentile: number;
  behavioralPercentile: number;
  narrative: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildResultsEmail({
  candidateName,
  roleName,
  companyName,
  cognitivePercentile,
  technicalPercentile,
  behavioralPercentile,
  narrative,
}: ResultsEmailParams): { subject: string; html: string } {
  const subject = `Your Assessment Results — ${roleName} at ${companyName}`;
  const safeCandidateName = escapeHtml(candidateName);
  const safeRoleName = escapeHtml(roleName);
  const safeCompanyName = escapeHtml(companyName);
  const safeNarrative = escapeHtml(narrative);

  function barHtml(label: string, percentile: number, color: string) {
    return `
      <tr>
        <td style="padding: 6px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 1px; width: 120px;">${label}</td>
              <td style="padding-left: 8px;">
                <div style="background-color: #e4e4e7; height: 8px; width: 100%; position: relative;">
                  <div style="background-color: ${color}; height: 8px; width: ${percentile}%;"></div>
                </div>
              </td>
              <td style="font-size: 12px; color: #0a1628; font-weight: 600; width: 50px; text-align: right; font-family: monospace;">${percentile}th</td>
            </tr>
          </table>
        </td>
      </tr>`;
  }

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
              <span style="color: #71717a; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-left: 8px;">Assessment Results</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px; font-size: 18px; color: #0a1628; font-weight: 700;">
                Hello ${safeCandidateName},
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #52525b; line-height: 1.6;">
                Thank you for completing the assessment for <strong>${safeRoleName}</strong> at <strong>${safeCompanyName}</strong>. Here is a summary of your performance across the three assessment layers.
              </p>

              <!-- Scores -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; padding: 16px; margin-bottom: 24px;">
                <tr><td style="padding: 16px;">
                  <p style="margin: 0 0 12px; font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Performance Summary</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${barHtml("Cognitive", cognitivePercentile, "#3b82f6")}
                    ${barHtml("Technical", technicalPercentile, "#c9a227")}
                    ${barHtml("Behavioral", behavioralPercentile, "#22c55e")}
                  </table>
                </td></tr>
              </table>

              <p style="margin: 0 0 24px; font-size: 13px; color: #52525b; line-height: 1.7;">
                ${safeNarrative}
              </p>

              <p style="margin: 0; font-size: 11px; color: #a1a1aa; line-height: 1.6;">
                This summary represents your performance relative to a normative sample. Results have been shared with the recruiting team for evaluation.
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

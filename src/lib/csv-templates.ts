export const CSV_TEMPLATE_HEADER = "first_name,last_name,email,phone,role_slug";

export const CSV_TEMPLATE_EXAMPLE = `${CSV_TEMPLATE_HEADER}
John,Doe,john@example.com,+1-555-0100,cnc-machinist
Jane,Smith,jane@example.com,,manufacturing-engineer
Sam,Jones,sam@example.com,,`;

interface CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role_slug: string;
}

export interface ValidatedRow extends CsvRow {
  rowIndex: number;
  errors: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });

  return { headers, rows };
}

export function validateCsvRows(
  rows: Record<string, string>[],
  validRoleSlugs: string[]
): ValidatedRow[] {
  const seenEmails = new Set<string>();

  return rows.map((row, index) => {
    const errors: string[] = [];
    const email = (row.email || "").trim().toLowerCase();
    const firstName = (row.first_name || "").trim();
    const lastName = (row.last_name || "").trim();
    const roleSlug = (row.role_slug || "").trim();

    if (!firstName) errors.push("First name is required");
    if (!lastName) errors.push("Last name is required");

    if (!email) {
      errors.push("Email is required");
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push("Invalid email format");
    } else if (seenEmails.has(email)) {
      errors.push("Duplicate email in batch");
    }
    seenEmails.add(email);

    // Empty role_slug defaults to generic-aptitude
    if (roleSlug && !validRoleSlugs.includes(roleSlug)) {
      errors.push(`Unknown role: ${roleSlug}`);
    }

    return {
      rowIndex: index + 2, // 1-indexed, +1 for header
      first_name: firstName,
      last_name: lastName,
      email,
      phone: (row.phone || "").trim() || undefined,
      role_slug: roleSlug,
      errors,
    };
  });
}

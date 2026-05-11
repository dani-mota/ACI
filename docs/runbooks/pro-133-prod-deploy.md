# PRO-133 — Prod-deploy runbook (covers PR#1 + PR#2)

Concrete, copy-pasteable procedure for deploying the PRO-133 branches to production. Manual gates by design — there's no CI automation around this; the deployer is the human checkpoint.

This runbook covers **both** PR#1 (`feat/pro-133-employee-mode-rbac`) and PR#2 (`feat/pro-133-pr2-employee-scoping`). PR#2 stacks on PR#1, so the deploy sequence applies both migrations in order.

## When to run

Before `vercel --prod` (or the equivalent release step) for any release that includes either the PR#1 or PR#2 branch. The branches ship:

**PR#1 schema:**
- New Prisma enum `EmployeeUserRole`
- New `User.employeeRole` column (nullable)
- New `Note.isPrivate` column (NOT NULL, default `false`)

**PR#2 schema (additive on top of PR#1):**
- New `Candidate.userId` column (nullable, unique FK to User)
- New `User.managerId` column (nullable self-FK)
- Indexes: `Candidate_userId_key` (unique), `User_managerId_idx`

…and code that reads/writes those columns. Migrating the schema before deploying the code is non-negotiable — old code is forward-compatible with the new columns (additive only), but new code crashes against the old schema.

## Prerequisites

- `DATABASE_URL` exported in your shell, pointing at the **production** Neon DB
- Neon DB accessible from your environment (VPN if required)
- Production DB snapshot taken (or confirmed available via Neon's continuous backup)
- This branch (`feat/pro-133-employee-mode-rbac`) checked out locally

**Before running any step below, run:**

```bash
echo $DATABASE_URL
```

**Confirm the host matches your prod database — not dev, not staging.** Every command in this runbook operates against whichever DB the variable points to. A `DATABASE_URL=$DEV_URL` typo would run the audit against dev (returns clean), then "deploy" against prod with stale information. Cheap to verify, expensive to recover from.

---

## Step 1 — Pre-deploy Note table audit

```bash
DATABASE_URL=$PROD_URL npx tsx scripts/audit-notes-pro-133.ts
```

The script always exits 0. It surfaces samples of Note content + flags any matching a soft-signal keyword regex (`/private|confidential|impression|concern|red flag/i`). **The decision is yours, not the script's.**

The regex false-positives on benign content ("Confirmed candidate handles private health information at prior role") and false-negatives on real risks ("Manager says this person can't handle stress"). Read the actual sampled note content. Don't trust the count alone.

### Decision tree

- **If any sampled content looks sensitive** — manager impressions, off-the-record signals, anything that wouldn't be safe to expose to the subject of the note: **STOP.**
  1. Update `prisma/migrations/20260507_pro_133_employee_mode_rbac/migration.sql` to use `DEFAULT true` on the `Note.isPrivate` column
  2. Push the change to `main`
  3. Re-deploy from the updated branch
  4. The migration default is now `true`; new notes are private-by-default, requiring explicit opt-in to make public

  No second path. The decision was made at planning time per Dani's hard requirement; this runbook is execution, not re-litigation.

- **If sampled content is uniformly operational** — scheduling, candidate-stage flags, neutral feedback like "schedule second interview" or "strong fit for senior IC": proceed to Step 2.

- **If unsure** — default `true`. Over-restriction is recoverable (manually flip `isPrivate=false` on notes the author wants public). Leakage is not.

---

## Step 2 — Check prod migration tracking status

```bash
DATABASE_URL=$PROD_URL npx prisma migrate status
```

- **If status is clean** (every migration in `prisma/migrations/` is listed as "Applied"): proceed to Step 3.
- **If status reports drift** (the prod schema has applied migrations that aren't tracked in `_prisma_migrations`): for each orphan migration named in the output, run:

  ```bash
  DATABASE_URL=$PROD_URL npx prisma migrate resolve --applied <migration_name>
  ```

  This marks the migration as "Applied" in `_prisma_migrations` without re-running its SQL. Repeat for every orphan. Then re-run `migrate status` and verify it comes back clean before proceeding to Step 3.

If the drift situation looks unfamiliar or you're unsure which migrations are safe to mark as applied, stop and investigate — `migrate resolve --applied` on a migration that hasn't actually been applied at the schema level would silently desync state.

---

## Step 3 — Apply the new migration(s)

```bash
DATABASE_URL=$PROD_URL npx prisma migrate deploy
```

Should apply (in order) any pending PRO-133 migrations:
- `20260507_pro_133_employee_mode_rbac` (PR#1)
- `20260511_pro_133_pr2_employee_linkages` (PR#2, if deploying with PR#2 in the release)

Step 2 confirmed everything else is tracked. Output should report the expected number of migrations applied (1 if only PR#1, 2 if both).

**If you hit shadow-DB drift errors and have to fall back to `db execute`:**

```bash
# Apply PR#1 first
DATABASE_URL=$PROD_URL npx prisma db execute --file prisma/migrations/20260507_pro_133_employee_mode_rbac/migration.sql
DATABASE_URL=$PROD_URL npx prisma migrate resolve --applied 20260507_pro_133_employee_mode_rbac

# Then PR#2 (only if deploying it in this release)
DATABASE_URL=$PROD_URL npx prisma db execute --file prisma/migrations/20260511_pro_133_pr2_employee_linkages/migration.sql
DATABASE_URL=$PROD_URL npx prisma migrate resolve --applied 20260511_pro_133_pr2_employee_linkages
```

PRO-181 tracks the recurring shadow-DB drift root cause. Once that ticket ships, this fallback is no longer needed.

---

## Step 4 — Post-deploy schema verification

```bash
DATABASE_URL=$PROD_URL npx tsx scripts/verify-pro-133-schema.ts
```

This is a **hard gate**. The script exits non-zero on any discrepancy. Expected output ends with:

```
✅ PRO-133 schema verification PASSED
```

The script covers **both PR#1 and PR#2** columns/enums:
- PR#1: `EmployeeUserRole` enum, `User.employeeRole`, `Note.isPrivate`
- PR#2: `Candidate.userId` + unique index, `User.managerId` + index

If verification fails: STOP. Investigate the migration state. Do NOT proceed to Step 5. The app code expects these columns to exist; deploying it against a half-migrated schema is unsafe.

The script also reports the observed `Note.isPrivate` default — confirm it matches what Step 1 led you to choose (`false` if audit was clean, `true` if you flipped per the decision tree).

---

## Step 5 — Deploy app code

```bash
vercel --prod
```

(Or whatever your release flow is.) The app code now reads/writes the new columns safely.

---

## Step 6 — Smoke test the deploy (manual)

In a browser logged in as an admin:

1. Navigate to `/dashboard?mode=employees` — should load
2. Click any employee row — dossier should load with full data
3. `/api/org/insights` — should return `{}` (200)
4. (Optional) Use the dev role switcher (visible only in dev — this is a smoke-test for prod readiness, so skip this step in prod, or use direct API calls with appropriate auth)

If anything is unexpected, you may still need to roll back (see below).

---

## Rollback procedure

If anything fails post-deploy:

### Code rollback

Redeploy the previous Vercel build:

```bash
vercel rollback
```

(Or use the Vercel dashboard.) This reverts the app code without touching the database.

### Schema rollback

NOT automatic. The new columns are additive + nullable + defaulted, so leaving them in place is safe even with the old app code. If you must remove them:

```sql
ALTER TABLE "Note" DROP COLUMN "isPrivate";
ALTER TABLE "User" DROP COLUMN "employeeRole";
DROP TYPE "EmployeeUserRole";
```

Also remove the corresponding row from `_prisma_migrations`:

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260507_pro_133_employee_mode_rbac';
```

### Deploy-window caveat for `Note.isPrivate`

If **Step 3 succeeds but Step 5 fails or rolls back**, prod has the new schema with the old code. `Note` inserts during the rollback window get `isPrivate = <schema default>` set at the DB level. Old code doesn't know the column exists, so it can't display the private/public flag correctly.

The risk is most pronounced if Step 1's audit flipped the default to `true` for prod — new notes from the rollback window get marked private, old code surfaces them as if public.

After recovery: investigate `Note` rows created between deploy-window start and end. Manually correct any whose `isPrivate` value doesn't match the author's intent.

---

## Post-deploy follow-ups

- Update the PR description on GitHub to note "deployed to prod on YYYY-MM-DD"
- If Step 1 forced a default-flip to `true`, document that decision in the PR comments so future archaeology knows why prod's migration differs from the branch as merged

---

## Reference

- Migration: `prisma/migrations/20260507_pro_133_employee_mode_rbac/migration.sql`
- Trust-contract helper: `src/lib/employee-permissions.ts` (canViewManagerNotes is the per-row gate)
- PR: `feat/pro-133-employee-mode-rbac` on `github.com/dani-mota/ACI`

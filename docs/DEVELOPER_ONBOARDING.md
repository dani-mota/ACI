# ACI Developer Onboarding

Welcome to ACI (Arklight Conversational Intelligence). This guide gets you from zero to a running local dev server.

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Git** access to the `dani-mota/ACI` repo (you must be added as a collaborator)
- **Claude Code** CLI (optional but recommended)
- **Cursor** or VS Code

## 1. Clone & Install

```bash
git clone git@github.com:dani-mota/ACI.git
cd ACI
npm install
```

`npm install` automatically runs `prisma generate` via the postinstall hook. If you see Prisma errors, run it manually:

```bash
npx prisma generate
```

## 2. Environment Setup

Copy the example env file:

```bash
cp .env.example .env.local
```

Then replace the placeholder values with the real credentials Daniel sent you. The **required** variables are:

| Variable | What it is | Where to get it |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Daniel sends this |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Daniel sends this |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | Daniel sends this |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | Daniel sends this |
| `ANTHROPIC_API_KEY` | Claude API key | Daniel sends this |
| `NEXT_PUBLIC_APP_URL` | Your local dev URL | `http://localhost:3000` |

**Optional** (TTS will fall back to browser speech without these):

| Variable | What it is |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs TTS API key |
| `ELEVENLABS_VOICE_ID` | Aria's voice ID |

Alternatively, run the setup script which validates your env:

```bash
npx tsx scripts/dev-setup-check.ts
```

## 3. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the login page.

## 4. Log In

Use the test credentials:

- **Email:** `dani@arklight.us`
- **Password:** Ask Daniel for the test password

If login fails with an auth error, your Supabase env vars are wrong or missing. Double-check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 5. Verify Everything Works

After login, you should land on the recruiter dashboard. To verify the full stack:

1. **Dashboard loads** — database connection is working
2. **Candidates list shows data** — Prisma + Neon are connected
3. **Create a test assessment link:**
   ```bash
   npx tsx scripts/create-ft-invitation.ts
   ```
   This outputs a URL like `http://localhost:3000/assess/cm...`. Open it to verify the assessment engine works.

## Architecture Overview

```
Browser (Next.js App Router)
  |
  +-- Supabase Auth (login, sessions, OAuth)
  |
  +-- Next.js API Routes
        |
        +-- Prisma ORM
              |
              +-- Neon PostgreSQL (all application data)
```

- **Supabase** handles authentication only (login, sessions, password reset)
- **Neon** is the actual database where all data lives (orgs, users, candidates, assessments, scores)
- **Prisma** is the ORM that talks to Neon
- Both of us share the **same** cloud database — there is no local DB

## Key Directories

```
src/
  app/                    # Next.js App Router pages + API routes
    (assess)/assess/      # Candidate-facing assessment UI
    (auth)/               # Login, onboarding, password reset
    (dashboard)/          # Recruiter dashboard
    api/assess/[token]/   # Assessment engine API (chat, TTS, scoring)
  lib/
    assessment/           # Core assessment engine (dispatcher, engine, turn builders)
    auth.ts               # Server-side auth helpers
    prisma.ts             # Prisma client singleton
    supabase/             # Supabase client setup (server, client, admin, middleware)
  stores/                 # Zustand stores (client state)
  components/             # React components
scripts/                  # CLI utilities (setup, invitations, content generation)
prisma/
  schema.prisma           # Database schema
  seed.ts                 # Seed data (constructs, archetypes)
```

## Useful Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build (runs prisma generate + next build) |
| `npm run test:setup` | Create test users + candidates in the Arklight org |
| `npm run test:reset` | Delete all test data |
| `npx tsx scripts/create-ft-invitation.ts` | Generate a fresh Factory Technician assessment link |
| `npx vitest run` | Run the test suite |
| `npx prisma studio` | Open Prisma's visual database browser |

## Git Workflow

- **Main branch:** `main` — push directly for now (small team)
- **Commit style:** `fix:`, `feat:`, `refactor:`, `docs:`, `debug:` prefixes
- **Linear integration:** Reference tickets as `PRO-XX` in commit messages
- **Before pushing:** Run `npx vitest run src/lib/assessment/__tests__/` to catch regressions

## Things NOT to Do

- **Do not run `npm run test:reset`** without telling Daniel — it wipes shared test data
- **Do not regenerate content libraries** (`scripts/generate-all-content-libraries.ts`) without coordinating — it's expensive (API calls) and affects live assessment content
- **Do not modify `.env.local` values** for Supabase/Neon and commit them — these are secrets
- **Do not run destructive Prisma commands** (`prisma migrate reset`, `prisma db push --force-reset`) — we share one database

## Troubleshooting

### "Authentication is not configured"
Your `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing or wrong.

### Login succeeds but redirects to /onboarding
Your Supabase user exists but has no matching Prisma User record. Run `npm run test:setup` to create the test users, or ask Daniel to check the user sync.

### "ECONNREFUSED" on scripts
The `DATABASE_URL` isn't being loaded. Make sure your `.env.local` is in the project root (not in `src/` or elsewhere). Scripts load it via `dotenv`.

### Prisma Client errors after pulling new code
Schema may have changed. Run:
```bash
npx prisma generate
```

### Assessment link shows 404 or "expired"
The invitation may have expired (7-day TTL). Generate a fresh one:
```bash
npx tsx scripts/create-ft-invitation.ts
```

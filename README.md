# Easi Ride

A weekly ride-subscription platform for students in Sierra Leone. Book shared or solo keke rides to campus — no haggling, no waiting.

## Tech Stack

- **React 18** + TypeScript (Vite)
- **TailwindCSS** + shadcn/ui
- **Supabase** — Auth, Database, RLS
- **Vercel Serverless** — `/api` routes (TomTom geocoding, fares, payments)
- **React Router v6**
- **Zod** — form validation

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in .env, then:
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

`npm run dev` serves the Vite frontend only. To test `/api/*` routes locally (location search, reverse geocode, fares):

```bash
npx vercel dev
```

## Project Structure

```
src/
├── pages/       # Route-level page components
├── components/  # Shared UI components
├── context/     # RideContext (state management)
├── hooks/       # useAuth hook
├── integrations/# Supabase client
└── lib/         # Utilities
api/             # Vercel serverless functions
supabase/
└── migrations/  # Database schema
```

## Environment Variables

Copy [`.env.example`](.env.example) to `.env`.

### Client (Vite — exposed to the browser)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Server (`/api` routes — never expose to the browser)

Set these in **Vercel → Project → Settings → Environment Variables** for Production (and Preview if needed):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TOMTOM_API_KEY=your-tomtom-api-key
```

Use the same Supabase URL and anon key as the `VITE_*` values. API handlers also accept `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as fallbacks, but explicit `SUPABASE_*` names are recommended on Vercel.

After changing env vars on Vercel, **redeploy** the project.

## Deploy checklist (Vercel)

1. Root directory: `easi-ride` (if the repo contains multiple apps).
2. Add `TOMTOM_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` for Production.
3. Redeploy.
4. Smoke test: `GET /api/search-locations?query=test` without auth should return JSON `401`, not a generic HTML 500.

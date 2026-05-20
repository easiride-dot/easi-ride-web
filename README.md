# Easi Ride

A weekly ride-subscription platform for students in Sierra Leone. Book shared or solo keke rides to campus — no haggling, no waiting.

## Tech Stack

- **React 18** + TypeScript (Vite)
- **TailwindCSS** + shadcn/ui
- **Supabase** — Auth, Database, RLS
- **Vercel Serverless** — `/api` routes (OpenStreetMap geocoding, fares, payments)
- **OpenStreetMap** — [Nominatim](https://nominatim.org/) (search & geocoding) + [OSRM](http://project-osrm.org/) (driving distance)
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
api/
├── _osm.ts      # Nominatim + OSRM helpers
└── ...          # Vercel serverless functions
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

### Server (`/api` routes)

Set in **Vercel → Settings → Environment Variables** (Production):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Optional OpenStreetMap overrides (defaults use public Nominatim + OSRM):

```
NOMINATIM_USER_AGENT=EasiRide/1.0 (you@example.com)
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
OSRM_BASE_URL=https://router.project-osrm.org
```

No API key is required for geocoding. Respect [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (identify your app via `NOMINATIM_USER_AGENT`). For high traffic, self-host Nominatim or use a commercial OSM geocoding provider and set `NOMINATIM_BASE_URL`.

You can remove `TOMTOM_API_KEY` from Vercel if it was set previously.

After changing env vars, **redeploy**.

## Deploy checklist (Vercel)

1. Root directory: `easi-ride` (if the repo contains multiple apps).
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Production.
3. Optionally set `NOMINATIM_USER_AGENT` with a contact email.
4. Redeploy.
5. Smoke test: `GET /api/search-locations?query=test` without auth → JSON `401`.

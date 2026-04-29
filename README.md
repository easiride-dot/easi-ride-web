# Easi Ride

A weekly ride-subscription platform for students in Sierra Leone. Book shared or solo keke rides to campus — no haggling, no waiting.

## Tech Stack

- **React 18** + TypeScript (Vite)
- **TailwindCSS** + shadcn/ui
- **Supabase** — Auth, Database, RLS
- **React Router v6**
- **Zod** — form validation

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

## Project Structure

```
src/
├── pages/       # Route-level page components
├── components/  # Shared UI components
├── context/     # RideContext (state management)
├── hooks/       # useAuth hook
├── integrations/# Supabase client
└── lib/         # Utilities
supabase/
└── migrations/  # Database schema
```

## Environment Variables

Copy `.env` and fill in your Supabase project credentials:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

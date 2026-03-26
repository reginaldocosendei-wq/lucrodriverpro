# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Session-based auth with bcryptjs
- **Payments**: Stripe (via Replit integration) + stripe-replit-sync for webhooks & DB sync

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── driver-metrics/     # Lucro Driver React frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Lucro Driver App

A full-featured ride-share driver earnings tracker (Lucro Driver). Features:
- Email/password auth with sessions (bcryptjs)
- Ride registration with per-km, net value, commission calculations
- Cost tracking (fuel, food, maintenance, rental, other)
- Monthly/weekly/daily goal setting and progress tracking
- Smart dashboard with earnings summaries and alerts
- Earnings reports and charts (Recharts) — PRO feature
- Freemium model: free plan gets basics, PRO unlocks reports & simulator
- 7-day PRO trial on new accounts (`trialStartDate` column, `computeEffectivePlan()` helper)
- Stripe subscription integration (monthly/yearly plans)

### PWA / Mobile App
- **Manifest**: `artifacts/driver-metrics/public/manifest.json` — standalone display, pt-BR, shortcuts
- **Service Worker**: `artifacts/driver-metrics/public/sw.js` — cache-first for assets, network-first for navigation, skips API calls
- **Icons**: `public/images/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (generated from `public/icon.svg` via ImageMagick)
- **Splash Screen**: `src/components/SplashScreen.tsx` — 1.6s animated splash, fades into app
- **Mobile CSS**: `index.css` — `100dvh`, `overscroll-behavior: none`, safe-area insets, touch-action, momentum scrolling, `-webkit-tap-highlight-color: transparent`
- **SW registration**: `main.tsx` — registers `${BASE_URL}sw.js` on window load
- **Installable on Android** via Chrome "Add to Home Screen" prompt

### Known Patterns & Gotchas
- `goals.tsx` useEffect: always use `const { reset } = form` (destructured), never put the whole `form` object in deps (causes infinite re-render)
- `Import.tsx`: always initializes `step = "locked"`, transitions to `"entry"` via `useEffect([isPro, step])` when user data loads
- `reports.tsx` chart props: always use `|| []` guards (Recharts crashes on null/undefined data)
- `Home.tsx` `bestPlatform`: guard with `!== "-"` before using as alert condition
- ErrorBoundary uses `console.log` (not just `console.error`) for crash logs — captured by log tool
- Dashboard API always returns numeric fields (never null) — no `?? 0` guards needed

### DB Schema (lib/db/src/schema/)
- `users` — id, name, email, password_hash, plan (free/pro)
- `rides` — ride entries with calculated net value, commission, value/km
- `costs` — expense entries by category
- `goals` — per-user daily/weekly/monthly targets

### API Routes (artifacts/api-server/src/routes/)
- `/api/auth` — register, login, logout, me
- `/api/rides` — CRUD for ride entries
- `/api/costs` — CRUD for cost entries
- `/api/goals` — get/upsert goals
- `/api/dashboard/summary` — aggregated stats
- `/api/reports/earnings` — chart data for PRO users

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`, uses `@workspace/api-zod` for validation, `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — CORS, sessions, JSON parsing, routes at `/api`
- Depends on: `@workspace/db`, `@workspace/api-zod`, `bcryptjs`, `express-session`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/users.ts` — users table
- `src/schema/rides.ts` — rides table
- `src/schema/costs.ts` — costs table
- `src/schema/goals.ts` — goals table

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

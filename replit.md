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

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (POS backend)
│   └── mobile/             # Expo React Native POS mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native POS mobile app for front-office operations on Android and iOS.

- Entry: `app/_layout.tsx` — providers, font loading, navigation structure
- Tabs: Orders, [Tables — restaurant only], [Appts — service only], Menu, History, Reports (Analytics), Settings
- Screens: `(tabs)/index` (open orders + alerts), `(tabs)/tables` (restaurant floor plan), `(tabs)/appointments` (service schedule), `(tabs)/reports` (WebView of Cloud-POS analytics), `new-order` (create order with modifiers + guest count), `order/[id]` (order detail), `checkout/[id]` (payment)
- Context: `context/CartContext.tsx` — cart state (supports selectedModifiers + unitQuantity per item, itemKey-based dedup), `context/SettingsContext.tsx` — industry mode + settings
- API client: `lib/api.ts` — fetch wrapper (products, orders, tables, appointments, reports, alerts, settings, modifiers)
- `components/ModifierSheet.tsx` — bottom-sheet modal: loads modifier groups per product, single/multi-select groups with price adjustments, unit quantity input for hourly/weight pricing, required-group validation, notes field
- Elavon branding: navy #0C2074, blue #0072C4, `components/ElavonLogo.tsx`
- Alerts: displayed on Orders tab header (stale orders, high void rate, no sales, many open orders) with dismiss + action
- Industry mode: restaurant/retail/service — stored in DB, updates terminology app-wide
- Analytics tab: WebView embedding `https://cloud-po-s-wilcoxisaac.replit.app`
- Back office URL: `https://cloud-po-s-wilcoxisaac.replit.app`
- Restaurant features: floor plan (Tables tab with Floor Plan / Reservations segment), table status (available/occupied/reserved/cleaning), tap table → new order pre-filled, item modifier picker, guest count on orders; Kitchen tab (KDS — live tickets with New/Preparing/Ready sections, bump workflow, 15s auto-refresh)
- Service features: Appointments tab with calendar view (month grid, dot indicators, day selection), today's schedule, status workflow (pending→confirmed→in-progress→completed/no-show), new appointment creation form (client, service, stylist, time)
- Reservations: within Tables tab (Floor Plan / Reservations toggle), date navigation, reservation cards with Seat/Confirm/No-show/Cancel actions, new reservation modal

### POS Database Schema

- `products` — product catalog (name, description, price, category, isActive, industry, sku, emoji, modifiers JSON, **pricingType: fixed|hourly|weight, unit, isBundle, bundleItems**)
- `orders` — order records (status: open/paid/voided, totals, payment info, guestCount for restaurant)
- `order_items` — line items (snapshots price + notes; **unitQuantity** for hourly/weight, **selectedModifiers** JSONB array)
- `modifier_groups` — named modifier groups (industryContext, selectionType: single|multiple, minSelections, maxSelections, isRequired)
- `modifier_options` — options within a group (name, priceAdjustment, isDefault, sortOrder)
- `product_modifier_groups` — explicit product↔group associations (productId, groupId, sortOrder)
- `category_modifier_groups` — category-level associations (industry, category, groupId) — auto-applies modifiers to all products in a category
- `app_settings` — key/value store for settings (industry mode, taxRate)
- `restaurant_tables` — floor plan tables (name, capacity, section, status, currentOrderId)
- `appointments` — service appointments (clientName, clientPhone, serviceName, staffName, date, time, duration, status, notes, orderId)
- `customers` — unified customer repository (name, email, phone, loyaltyPoints, notes); auto-upserted on quote/invoice creation; loyalty points awarded on invoice payment (1pt/$)
- Tax rate: 8% (configurable via app_settings)

### API Routes

- `GET/PUT /api/settings` — get/update app settings (industry, taxRate)
- `GET /api/alerts` — compute live alerts from DB (stale orders, void rate, etc.)
- `POST /api/alerts/:id/dismiss` — dismiss an alert
- `GET /api/reports/summary` — unified revenue stats merging mobile POS + Cloud POS transactions (deduped); returns `mobilePOS`/`cloudPOS` breakdowns per period + `sources` connection status
- `POST /api/sync/receive-transaction` — inbound webhook: Cloud POS pushes its paid orders here; stores them as local orders tagged `notes: "synced_from:cloud_pos"`
- `GET /api/tables` — list restaurant tables with live order info
- `PATCH /api/tables/:id` — update table status / link an order
- `GET /api/appointments?date=YYYY-MM-DD` — list appointments for a date
- `GET /api/appointments?month=YYYY-MM` — list all appointments for a month (calendar dots)
- `POST /api/appointments` — create an appointment
- `PATCH /api/appointments/:id` — update status/staff/notes
- `DELETE /api/appointments/:id` — remove an appointment
- `GET /api/kitchen` — open orders with items, excludes served (for KDS screen)
- `PATCH /api/orders/:id/kitchen` — advance kitchen status (new→preparing→ready→served)
- `GET /api/reservations?date=YYYY-MM-DD` — list reservations for a date
- `POST /api/reservations` — create reservation
- `PATCH /api/reservations/:id` — update reservation status/notes
- `DELETE /api/reservations/:id` — delete reservation
- `GET /api/modifier-groups` — list all modifier groups (filter by ?industryContext=)
- `POST /api/modifier-groups` — create modifier group + options
- `PATCH /api/modifier-groups/:id` — update modifier group
- `DELETE /api/modifier-groups/:id` — delete modifier group
- `GET /api/products/:id/modifier-groups` — merged product + category modifier groups for a product
- `POST /api/products/:id/modifier-groups` — associate group with product
- `DELETE /api/products/:id/modifier-groups/:groupId` — remove product↔group association
- `GET /api/customers` — list all customers with computed stats (quoteCount, invoiceCount, orderCount, totalSpend)
- `GET /api/customers/:id` — customer detail with full stats (avgQuoteAcceptDays, avgInvoicePayDays, topItems, purchase history)
- `POST /api/customers` — create customer
- `PATCH /api/customers/:id` — update customer (name, email, phone, notes, loyaltyPoints)
- Auto-upsert: creating a quote or invoice automatically creates/updates the matching customer record (matched by email, then name)
- Loyalty: 1 point per dollar awarded on invoice payment via portal

### Quotes / Invoices / Customer Portal

- **DB tables**: `quotes` (token column for portal), `quote_items`, `invoices` (token column), `invoice_items` — in `lib/db/src/schema/invoices.ts`
- **API routes**:
  - `GET/POST /api/quotes` — list / create quotes
  - `GET/PATCH/DELETE /api/quotes/:id` — get / update / delete quote
  - `POST /api/quotes/:id/send` — generate token, email customer (Resend), mark sent, return `{portalUrl, emailSent}`
  - `POST /api/quotes/:id/accept` — in-app accept (creates invoice); same logic as portal respond
  - `GET/POST /api/invoices`, `GET/PATCH/DELETE /api/invoices/:id`, `POST /api/invoices/:id/pay`, `POST /api/invoices/:id/send`
  - `GET /api/portal/quotes/:token` — customer-facing HTML quote portal (accept/decline with line-item selection)
  - `GET /api/portal/quotes/:token/data` — JSON data for portal
  - `POST /api/portal/quotes/:token/respond` — customer accepts/declines; on accept auto-creates invoice
  - `GET /api/portal/invoices/:token` — customer-facing HTML invoice view with full payment UI
  - `GET /api/portal/invoices/:token/data` — JSON data for invoice portal
  - `GET /api/portal/invoices/:token/pay/config` — returns which payment methods are configured
  - `POST /api/portal/invoices/:token/pay/converge-session` — requests Elavon Converge session token for Lightbox
  - `POST /api/portal/invoices/:token/pay/apple-pay/validate-merchant` — Apple Pay merchant validation (server-to-Apple)
  - `POST /api/portal/invoices/:token/pay/affirm/charge` — charge Affirm checkout_token and mark invoice paid
  - `POST /api/portal/invoices/:token/pay/complete` — mark invoice paid after Converge/Apple Pay/Google Pay/Paze
  - `GET /.well-known/apple-pay-merchant-id-domain-association` — serves Apple Pay domain verification file
- **Email**: `artifacts/api-server/src/lib/email.ts` — Resend integration, graceful no-key fallback; `RESEND_API_KEY` env var required for actual email; `FROM_EMAIL` env var for sender
- **Portal URL pattern**: `https://{REPLIT_DEV_DOMAIN}/api/portal/quotes/{token}` (set via `PORTAL_BASE_URL` env var override)
- **Mobile**: Quotes/Invoices tab — "Email Quote/Invoice to Customer" button triggers send, opens native Share sheet with portal link
- **Invoice payment portal**: Full multi-method payment UI at `/api/portal/invoices/:token`. Methods shown based on configured env vars:
  - **Elavon Converge Lightbox** (Credit Card): `CONVERGE_MERCHANT_ID`, `CONVERGE_USER_ID`, `CONVERGE_PIN`, `CONVERGE_ENV` (demo/production)
  - **Apple Pay**: `APPLE_PAY_MERCHANT_ID`, `APPLE_PAY_MERCHANT_CERT` (base64 PEM), `APPLE_PAY_MERCHANT_KEY` (base64 PEM), `APPLE_PAY_DISPLAY_NAME`, `APPLE_PAY_DOMAIN_ASSOCIATION` (domain file content)
  - **Google Pay**: Always shown in TEST mode; `GOOGLE_PAY_MERCHANT_ID` for production — tokenizes through Elavon gateway
  - **Paze**: `PAZE_CLIENT_ID`, `PAZE_CLIENT_NAME`, `PAZE_ENV` (sandbox/production)
  - **Affirm BNPL**: `AFFIRM_PUBLIC_KEY`, `AFFIRM_PRIVATE_KEY`, `AFFIRM_ENV` (sandbox/production)

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

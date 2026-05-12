# Internal Backend (Spring Boot)

Spring Boot API for the InternAL frontend. Uses Supabase (PostgREST + Auth JWT validation).

## Run locally

```bash
cd internal-backend
mvn spring-boot:run
```

Default port: `8080` (override with `SERVER_PORT`).

## Environment variables

Shared project env can live in the repo root `.env`; Spring loads optional `../.env` via `spring.config.import`.

### Core

- `SERVER_PORT` (optional): HTTP port, default `8080`.
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (JWT validation).
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for PostgREST writes when RLS blocks user JWT (required for several flows).
- `SUPABASE_JWT_SECRET`: JWT validation (per existing security setup).
- `FRONTEND_URL`: Public Next.js origin with **no** trailing slash (e.g. `http://localhost:3000` or `https://your-app.vercel.app`). Used for Stripe Checkout `success_url` / `cancel_url` validation and other redirects.

### Stripe Premium (monthly subscription)

Apply `docs/sql/premium_stripe.sql` in the Supabase SQL editor before testing Premium checkout.

- `STRIPE_SECRET_KEY`: Secret API key (`sk_...`).
- `STRIPE_WEBHOOK_SECRET`: Signing secret for `POST /api/stripe/webhook` (`whsec_...`). Point Stripe CLI or Dashboard webhooks to `{your-backend}/api/stripe/webhook`.
- `STRIPE_PRICE_PREMIUM_MONTHLY`: Recurring monthly **Price** id (`price_...`).
- `PREMIUM_MOCK_PAYMENT_ENABLED` (optional): Set `true` only for local demos to enable `POST /api/student/premium/mock-payment`. Default `false`.

Never grant Premium from the browser alone; entitlement is updated from verified Stripe webhooks on the server.

**Customer Portal (manage / cancel subscription)**  
In [Stripe Dashboard → Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal), activate the portal and choose which features customers can use (cancel subscription, update payment method, etc.). Students open it via `POST /api/student/premium/billing-portal` after they have a Stripe customer id (created at first successful Checkout).

### Endpoints (selection)

- `GET /api/health`
- `GET /api/student/profile` (student JWT)
- `POST /api/student/premium/checkout-session` (student JWT) — returns `{ "url": "<Stripe Checkout URL>" }`
- `POST /api/student/premium/billing-portal` (student JWT) — returns `{ "url": "<Stripe Customer Portal URL>" }`; requires an existing subscription/customer from Checkout
- `POST /api/stripe/webhook` — **no JWT**; validates `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`

# Companio — Website + Admin + API (monorepo)

"Rent a friend, not a date." A platonic, 18+, safety-first marketplace for booking verified companions
for activities (gym partner, movie buddy, city guide, event plus-one…).

Built to the **Platform Plan**: one backend, one design system, one codebase. The website and admin
panel are done. The React Native (Expo) app plugs in later as `apps/mobile`, reusing
`packages/types`, `packages/api-client` and the design tokens.

```
apps/
  api/      NestJS + Prisma + Socket.IO   → http://localhost:4000  (Swagger: /docs)
  web/      Next.js 15 website + web app  → http://localhost:3000  (PWA, SEO landing pages; admin panel at /admin)
packages/
  types/        shared DTOs, enums, catalog (categories × cities), formatters
  ui/           design tokens (Tailwind preset) + React primitives (candy / neo-brutalist)
  api-client/   typed SDK used by web + admin (and later mobile)
```

## Quick start

Requires Node ≥ 20.9. No Docker or Postgres is needed for local dev (SQLite).

```bash
npm install
cp apps/api/.env.example apps/api/.env        # already done if you cloned this folder as-is
npm run setup                                  # builds @companio/types, creates the DB, seeds demo data
npm run dev                                    # api :4000 · web :3000 (admin panel at /admin)
```

To reset the demo data later, run `npm run db:reset -w @companio/api`. This wipes the database.

### Demo accounts (seeded)

| Who | Login |
|---|---|
| Admin | http://localhost:3000/admin → `admin@companio.local` / `admin12345` |
| Member (Aarav, Jaipur, ₹500 wallet) | phone `9000000001` |
| Companion (Priya, Jaipur, verified) | phone `9000000002` |
| Companion (Rohan, Pune, KYC pending) | phone `9000000003` |

In dev, the OTP is printed in the API log and shown on the login screen (`OTP_DEV_ECHO=true`).
Payments use a **mock gateway** by default, which shows a fake UPI/card sheet.

## What's in it

**Website (acquisition + full booking flow)**
- Home, Explore (search, filters, sort, pagination), companion profiles with reviews and availability.
- **SEO**: ISR landing pages for every category × city (100+ cities; the 10 featured cities are pre-built, the rest render on first visit) at `/explore/<category>/<city>`,
  each with unique copy, FAQs and JSON-LD (FAQPage, BreadcrumbList, ItemList). There is also a sitemap, robots, a canonical URL on every page, and a generated OG image.
- Phone OTP login and onboarding (DOB must be 18+, platonic guidelines must be accepted).
- Booking flow:
  - Booking: activity, date and time limited to the companion's weekly availability (IST), public meeting point, and a live quote from the server.
  - Checkout: wallet credit plus mock or **Razorpay** payment.
  - Booking page: status timeline, 4-digit start code, realtime chat that masks phone, email, UPI and links, live-location sharing, **SOS**, cancel/decline, confirm and release, review, dispute, report and block.
- Companion side:
  - Apply, then KYC (ID upload plus a live webcam selfie).
  - Dashboard with earnings, escrow, requests and a listing toggle.
  - Profile, photo and weekly-availability editor.
  - Wallet and UPI payouts.
- Account settings: blocked users and **in-app account deletion** (an app-store requirement).
- Notifications (in-app plus realtime toasts), plus static pages: how it works, safety, guidelines, terms, privacy and blog.
- **PWA**: manifest, generated icons, a service worker (offline shell and web push handler), and an install prompt.
  Deep-link files are in `public/.well-known/` (replace the placeholder IDs when the native app ships).

**Admin panel (operations)**
- Dashboard: GMV, revenue, escrow, work queues, and 14-day charts (each with a table view).
- **SOS** alerts (realtime, with phone and map link), **KYC** review (signed private file URLs), and **disputes** (refund, split or release, with a settlement preview).
- **Moderation**: user reports (dismiss, warn, suspend or ban, and hide the message) and auto-flagged chat messages.
- **Payouts** (mark paid with a UTR, or reject and re-credit), bookings with the full transcript, payments and escrow, and refunds or goodwill credits.
- Users (search, detail, ledger, suspend, ban), review moderation, **platform settings** (fees, commission and windows; the API enforces them), and an audit log.

**API (single source of truth: all rules live here)**
- Pricing: `rate × hours + connection fee + GST on the fee`. The companion earns `subtotal − commission`. The defaults (₹99, 18%, 15%) can be edited in admin.
- **Escrow**: the full total is held at payment and settled exactly once, split into a refund to the user's wallet, a release to the companion's wallet, and the remainder retained as revenue.
- Booking state machine:
  - Main path: `PENDING_PAYMENT → REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED`.
  - Other outcomes: `DECLINED`, `EXPIRED`, `CANCELLED` and `DISPUTED`.
  - Background jobs handle unpaid expiry, unanswered requests, no-shows, auto-completion and auto-release after the dispute window.
- Cancellation policy:
  - Before acceptance: full refund.
  - 24 hours or more before the start: the subtotal is refunded (the fee is kept).
  - Less than 24 hours before: 50% refund.
  - If the companion cancels: full refund.
- Security:
  - JWT auth with roles.
  - Rate-limited OTP (hashed, 5-minute expiry, attempt limits).
  - Throttling.
  - Idempotent payment capture and a verified Razorpay webhook.
  - Atomic wallet debits with no overdraw.
  - Phone numbers are masked for everyone except admins.
  - KYC files are only reachable through HMAC-signed URLs that expire after 15 minutes.

## Going to production

1. **Postgres**: in `apps/api/prisma/schema.prisma`, set `provider = "postgresql"` and point `DATABASE_URL` at your database
   (`docker compose up -d` starts Postgres 16 and Redis 7 locally). Then run `npx prisma migrate dev` to create migrations.
2. **Secrets**: set a long random `JWT_SECRET`, and set `OTP_DEV_ECHO=false`.
3. **SMS**: implement `apps/api/src/auth/sms.service.ts` (MSG91, Gupshup or Twilio).
4. **Payments**: set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, and
   point the Razorpay webhook at `POST /payments/webhook/razorpay` (events: `payment.captured`, `order.paid`).
5. **Scale-out**: add `@socket.io/redis-adapter` and move `BookingsJobs` into a BullMQ worker. Both are marked in the code.
6. **Uploads**: swap local disk (`apps/api/uploads`) for S3/R2, using private buckets for KYC.
7. **Store rules (for the native app)**: keep the 18+ rating and platonic positioning, and keep report/block and in-app deletion. Booking payments
   use your own gateway, which is allowed because it pays for a real-world service. Digital subscriptions may need IAP.

## Deploying the API to an Ubuntu server

The website and admin run on Netlify; the API and its SQLite database run on one Ubuntu server behind Nginx + HTTPS,
kept alive by PM2. Everything is in [`deploy/`](deploy/).

1. Point a DNS A record (e.g. `api.yourdomain.com`) at the server, clone the repo there, then run
   `./deploy/setup-server.sh api.yourdomain.com you@yourdomain.com` once. It installs Node 20, Nginx, PM2 and a firewall,
   gets an HTTPS certificate, creates `/srv/companio-data` (database, uploads, backups) and `apps/api/.env`, and
   schedules a daily backup.
2. Edit `apps/api/.env` (CORS/Netlify URLs, Razorpay keys, SMS provider, admin login), then run `./deploy/deploy.sh --no-pull`
   and `npm run db:create-admin -w @companio/api`. Don't run the seed on a live server; it inserts demo data.
3. On Netlify (base directory `apps/web`), set `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` and redeploy. The admin panel is
   part of the website at `<website>/admin`, so there's only one Netlify site.

Updates: `./deploy/deploy.sh` (backs up, pulls, builds, updates the schema, restarts, health-checks).
In production the API refuses to start with the dev JWT secret, mock payments or localhost CORS origins.

## Scripts

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run db:setup -w @companio/api` · `npm run db:studio -w @companio/api`

# ServiConnect — Developer Guide

## What's in this scaffold

| Package | Purpose | Port |
|---|---|---|
| `backend/` | NestJS REST API, Prisma ORM, JWT auth, all business logic | 3000 |
| `frontend-web/` | Next.js 14 business dashboard + admin | 3001 |
| `mobile/` | React Native (Expo) customer + business app | Expo Go |

---

## Step 1 — Set up your local database

```bash
# Install PostgreSQL locally or use Supabase free tier
# Then create the database:
psql -U postgres -c "CREATE DATABASE serviconnect;"

cd backend
cp .env.example .env        # fill in DATABASE_URL
pnpm install
npx prisma migrate dev --name init
npx prisma db seed          # creates 15 categories + admin user
```

## Step 2 — Run the backend

```bash
cd backend
pnpm dev
# → http://localhost:3000
# → http://localhost:3000/api  (Swagger UI)
```

In dev mode, OTP codes are logged to the server console — no Twilio needed yet.

## Step 3 — Run the web dashboard

```bash
cd frontend-web
cp .env.example .env.local
pnpm install
pnpm dev
# → http://localhost:3001
```

## Step 4 — Run the mobile app

```bash
cd mobile
pnpm install
npx expo start
# Scan QR code with Expo Go (iOS/Android)
```

---

## Key API endpoints (Phase 1)

```
POST  /api/v1/auth/otp/send          Send OTP to phone
POST  /api/v1/auth/otp/verify        Verify OTP → get JWT
GET   /api/v1/auth/me                Get current user

GET   /api/v1/search?q=paving&lat=..&lng=..   Search businesses
GET   /api/v1/search/categories      All service categories
GET   /api/v1/search/autocomplete?q= Search suggestions

GET   /api/v1/businesses/:slug       Public business profile
POST  /api/v1/businesses             Create business (auth required)
PATCH /api/v1/businesses/:id         Update business
GET   /api/v1/businesses/me/profile  My business
GET   /api/v1/businesses/me/dashboard Dashboard stats

POST  /api/v1/leads                  Customer sends quote request
GET   /api/v1/leads/my               Customer's sent leads
GET   /api/v1/leads/business/:id     Business lead inbox
POST  /api/v1/leads/:id/quote        Business sends quote
POST  /api/v1/leads/quotes/:id/accept Customer accepts quote

GET   /api/v1/reviews/business/:id   Business reviews
POST  /api/v1/reviews                Submit review
```

---

## Build order (recommended)

### Week 1–2: Core auth + businesses
- [ ] Run migrations, seed categories
- [ ] Test `POST /auth/otp/send` and `POST /auth/otp/verify` in Swagger
- [ ] Create your first business via `POST /businesses`
- [ ] Open `GET /businesses/:slug` and confirm it returns

### Week 3–4: Search
- [ ] Test `GET /search?q=paving` — returns empty until you add businesses
- [ ] Add `lat` and `lng` params to test geo filtering
- [ ] Build the mobile `SearchScreen` — wire it to the API
- [ ] Test category filter chips

### Week 5–6: Leads + quotes
- [ ] Post a test lead via Swagger
- [ ] Check business lead inbox
- [ ] Send a quote, accept it — confirm status changes
- [ ] Wire up the web dashboard lead inbox page

### Week 7–8: Payments
- [ ] Create Stripe products for Starter/Pro/Enterprise plans
- [ ] Add subscription plan IDs to `.env`
- [ ] Implement `POST /subscriptions/checkout` (Stripe Checkout Session)
- [ ] Add Stripe webhook handler for `customer.subscription.*` events

### Week 9–10: Reviews + verification
- [ ] Wire review submission on mobile after completed jobs
- [ ] Build admin verification queue (approve/reject business docs)

---

## Adding Stripe subscriptions (Phase 1 payments)

```typescript
// In a new SubscriptionsService:
async createCheckoutSession(businessId: string, plan: SubscriptionPlan) {
  const priceId = {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    PRO: process.env.STRIPE_PRICE_PRO,
    ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
  }[plan];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=1`,
    cancel_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
    metadata: { businessId },
  });

  return { url: session.url };
}
```

---

## File upload setup (AWS S3)

```typescript
// In UploadsService (Phase 2 — stub exists already):
// 1. Create S3 bucket in af-south-1 region
// 2. Set CORS policy on bucket to allow your domain
// 3. Use presigned URLs — backend generates URL, mobile uploads directly to S3
//    This avoids routing large files through your server.

const command = new PutObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: `businesses/${businessId}/${filename}` });
const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
// Return presignedUrl to client → client PUTs the file directly
```

---

## Modules still to build (Phase 2)

| Module | File location | Description |
|---|---|---|
| Uploads | `backend/src/uploads/` | S3 presigned URLs for photos + voice notes |
| Admin | `backend/src/admin/` | Verification queue, user management |
| Messaging | `backend/src/messages/` | In-app message thread per lead |
| Subscriptions | `backend/src/subscriptions/` | Stripe checkout + webhook handler |
| Ads | `backend/src/ads/` | Boost budget management + daily reset cron |
| Notifications | Firebase FCM integration | Push notifications for new leads |

---

## Environment notes

- `NODE_ENV=development` → OTP codes log to console, no SMS sent. Safe to test locally.
- All prices stored in **ZAR cents** (R100 = 10000 in the database). Divide by 100 to display.
- Slugs are auto-generated on business creation from the business name + timestamp suffix.
- The `ratingAvg` and `reviewCount` on `Business` are denormalised — updated automatically when a review is created/deleted.

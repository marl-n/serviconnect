# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ServiConnect is a lead-generation marketplace for local services in South Africa (Joburg first). There is no root workspace: there are three independent packages, each with its own `package.json`, and each uses pnpm.

| Package | Stack | Port |
|---|---|---|
| `backend/` | NestJS 10, Prisma 5, Postgres, JWT (passport) | 3000 |
| `frontend-web/` | Next.js 14 business dashboard and admin (mostly a stub) | 3001 |
| `mobile/` | Expo / React Native app for customers and businesses | Expo Go |

## Commands

Backend (run from `backend/`):
```bash
pnpm install
cp .env.example .env              # needs DATABASE_URL
npx prisma migrate dev            # apply migrations + regenerate client
npx prisma db seed                # categories, subcategories, category questions, admin user
pnpm dev                          # nest start --watch → http://localhost:3000, Swagger at /api
pnpm build                        # nest build
pnpm test                         # jest, specs in src/**/*.spec.ts
pnpm test -- src/credits/credits.service.spec.ts   # single file
pnpm test -- -t "unlock"                           # by test name
pnpm import:locations -- --dry-run --report prisma/data/geonames/dry-run-report.json
pnpm import:locations             # GeoNames → Province/Town/Suburb (idempotent, never deletes)
```

Web: `cd frontend-web && pnpm dev`. Mobile: `cd mobile && npx expo start`.

None of the packages has a linter configured, and only the backend has tests.

## Backend architecture

- **Routing:** `main.ts` sets the global prefix `api/v1`, so every route is `/api/v1/...`. It also enables a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`. A field that is missing from a DTO is rejected with a 400, so any new request field has to be added to the DTO with class-validator decorators.
- **Auth:** OTP phone login (`/auth/otp/send` → `/auth/otp/verify` → JWT). With `NODE_ENV=development`, OTP codes go to the server console instead of Twilio. No guard is registered globally. Each protected route opts in with `@UseGuards(JwtAuthGuard, RolesGuard)` plus `@Roles(...)`, and reads the user via `@CurrentUser()` from `src/common/decorators`. The roles are `UserRole` in the Prisma schema (CUSTOMER / BUSINESS / ADMIN).
- **Data access:** every module goes through `PrismaService` from `src/common/prisma`. The full domain model lives in `prisma/schema.prisma`, and changes to it need a new migration (`npx prisma migrate dev --name <name>`).
- **Uploads:** `POST /uploads/images` stores images on local disk in `backend/uploads/` (gitignored), served at `/uploads/<file>` outside the `api/v1` prefix. This is MVP storage; move to S3 before running more than one instance.
- **Notifications** (`notifications/`): in-app only. `NotificationsService.send` never throws, so a failed notification can't fail the action that triggered it. Matching sends NEW_LEAD (only for newly created leads). Unlocking sends LEAD_UNLOCKED, quoting sends NEW_QUOTE, and accepting sends QUOTE_ACCEPTED and QUOTE_DECLINED. The mobile app polls `/notifications/unread-count` every 30 s. There is no phone push yet.
- **Stub modules:** `AdminModule` is an empty placeholder. Stripe subscriptions, messaging and ads are planned (see `DEVELOPER_GUIDE.md`) but have not been built.

### Two lead flows (important)

1. **Legacy direct leads** (`leads/`): a customer sends a quote request straight to one business, and the business replies with a `Quote` that the customer accepts. These leads have `serviceRequestId = null`, need no unlocking and cost no credits.
2. **Service requests + credits** (`service-requests/`, `credits/`, `category-questions/`): a customer posts a `ServiceRequest` for a category/subcategory with a town or suburb and answers to `CategoryQuestion`s. The answers are validated against the question definitions by `CategoryQuestionsService.validateAnswers`. Businesses pay credits from their `BusinessWallet` to unlock the leads generated from a request.
   - **Matching** (`matching/`): on `create`, `MatchingService.matchRequest` creates one locked `Lead` per business with the same category, the request's sub-category (`BusinessSubCategory`) and the request's town (`BusinessServiceArea`); suburbs never restrict. It skips suspended businesses and the customer's own business. When a business changes its sub-categories or service areas, `matchBusiness` back-fills open requests from the last 14 days. Both are idempotent through `@@unique([serviceRequestId, businessId])`.
   - **Feed and unlock** (`leads/`): `GET /leads/feed` hides the customer's name, phone and street address until a lead is unlocked. `POST /leads/:id/unlock` calls `CreditsService.unlockLead`, which also claims one of `MAX_UNLOCKS_PER_REQUEST` (3) slots through a conditional increment of `ServiceRequest.unlockCount`. Quotes need an unlocked lead. Accepting a quote fulfils the request and declines the competing quotes.
   - **Config:** the unlock price is `LEAD_UNLOCK_CREDITS` (default 10), and new businesses get `WELCOME_CREDITS` (default 30). There is no credit purchase flow yet.

`CreditsService` is the money path. Every balance change happens inside a single `prisma.$transaction`, made up of:
- a conditional `updateMany` debit (`balance >= cost`)
- an append-only `CreditTransaction` ledger row with a unique `idempotencyKey` (e.g. `unlock:<leadId>`)
- a race-checked flip of `Lead.isUnlocked`

Keep that pattern for any new credit operation. `credits.service.spec.ts` uses a hand-written in-memory Prisma fake with per-transaction undo logs to test concurrency, so extend that fake instead of switching to a real database.

### Locations

`Province → Town → Suburb` comes from GeoNames data in `prisma/data/geonames/`. The parsing and matching logic is pure and unit-tested in `src/locations/geonames.ts`. `prisma/import-locations.ts` is the CLI that writes it to the database: it matches existing rows on `geonameId` and never deletes, so existing references stay valid. Its header comment documents the import flags and how to download the source files. Businesses declare where they work through `BusinessServiceArea`. GeoNames is licensed CC BY 4.0 and needs attribution in the product.

### Seed data

`prisma/seed.ts` (~1400 lines) is the source of truth for categories, subcategories and the per-subcategory quote questions (`questionGroups`). New quote questions are added there.

## Mobile architecture

- Despite `expo-router` being the entry point, there is only one route, `app/index.tsx`. It loads the token from AsyncStorage (`sc_token`) and calls `/auth/me`, then switches between login, business onboarding/dashboard (for the BUSINESS role) and the customer tabs, which are driven by local `activeTab` state. Screens live in `src/screens/{auth,customer,business}`.
- All API calls go through `src/services/api.ts` (axios plus a bearer-token interceptor). The base URL comes from `EXPO_PUBLIC_API_URL` in `mobile/.env`, which must be set or the app throws at startup. It can be written with or without `/api/v1`, since the client appends the path only when it's missing. Expo inlines the value at bundle time, so restart with `npx expo start --clear` after changing it. EAS builds need the variable set in the EAS environment because `.env` is gitignored.

## Conventions

- Money is stored as integer **ZAR cents** (R100 = 10000).
- `Business.slug` is generated on creation from the name plus a timestamp suffix.
- `Business.ratingAvg` and `reviewCount` are denormalised and kept in sync by the reviews service when a review is created or deleted.
- Services validate cross-entity consistency explicitly: the subcategory must belong to the category, and the suburb to the town. New endpoints follow the same pattern.

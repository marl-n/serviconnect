# ServiConnect — MVP Scaffold
> Local services lead-generation marketplace. Joburg-first.
> Stack: NestJS API · Next.js business dashboard · React Native mobile app

## Project Structure
```
serviconnect/
├── backend/          # NestJS REST API
├── frontend-web/     # Next.js business dashboard + admin
├── mobile/           # React Native
```

## MVP Phase 1 Scope
1. Auth — OTP phone login (customer + business)
2. Business onboarding — profile creation, photo upload
3. Customer search — keyword + location + category filter
4. Business listings — public profiles, reviews, pricing
5. Quote requests — customer sends lead, business gets it in dashboard
6. Payments — Stripe subscription tiers

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env        
pnpm install
npx prisma migrate dev
npx prisma db seed
pnpm dev                    
# Swagger docs: http://localhost:3000/api
```

### Web Dashboard
```bash
cd frontend-web
cp .env.example .env.local
pnpm install
pnpm dev                    # http://localhost:3001
```

### Mobile
```bash
cd mobile
pnpm install
npx expo start              # Expo Go app
```

## Deployment 
- Backend → Railway.app (free tier → paid)
- Web → Vercel (free)
- DB → Supabase (managed Postgres, free tier)
- Redis → Upstash (free tier)
- Storage → AWS S3 af-south-1
- Mobile → Expo EAS Build → App Store + Play Store

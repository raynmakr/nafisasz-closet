# NAFISA'S CLOSET - PROJECT CONTEXT

## PROJECT IDENTITY
- **Name:** Nafisa's Closet (codename - will rebrand later)
- **Domain:** nafisaszcloset.com (temporary)
- **Version:** 1.0 MVP
- **Type:** Mobile marketplace app (iOS + Android)
- **Stage:** Phase 2 - Active Development
- **Last Updated:** 2025-12-27

## CURRENT STATUS

### Completed Features
- [x] Google/Apple Sign-In authentication
- [x] Invitation code system for new users
- [x] Curator application flow
- [x] Create/publish listings with photos (Cloudinary)
- [x] Discover feed with active listings
- [x] Listing detail page with countdown timer
- [x] Place claims (bids) on listings
- [x] Timer extension on last-minute claims
- [x] Likes system with shared state (Zustand + AsyncStorage)
- [x] Activity tab with Likes, Claims, and Following tabs
- [x] Follow/unfollow curators from listing page, curator profile, and Activity tab
- [x] Pull-to-refresh on listing detail, curator profile, and Activity tabs
- [x] Cache invalidation for follow state across all screens
- [x] Curator profile page with active listings
- [x] My Posts page for curators
- [x] Delete own listings
- [x] Search curators by name/handle
- [x] Deep purple theme with glass effects

### Known Issues
- [ ] User names may show as "Unknown" if not set during signup - need to prompt for name
- [ ] Domain nafisaszcloset.com not fully configured (Wix DNS conflict)

## NEXT STEPS

### High Priority
1. **Payment Integration** - Stripe Connect for curator payouts and buyer charges
2. **Push Notifications** - Outbid alerts, new listings from followed curators
3. **Transaction Flow** - Winner payment, curator purchase confirmation, shipping

### Medium Priority
4. **Profile Completion** - Prompt users to add name/bio if missing
5. **Edit Listings** - Allow curators to edit draft listings before publishing
6. **Order History** - Won items, sold items, shipping tracking
7. **Messaging** - In-app chat between buyer and curator

### Future
8. **Resend Email Setup** - Curator application notifications
9. **Hunt Stories** - Video posts from boutiques
10. **VIP Buyer Subscription** - Early access to listings

## TODO / PENDING SETUP
- [x] **Stripe Connect** - Marketplace payments for curators (implemented)
- [ ] **Push Notifications** - Expo Push for real-time alerts
- [ ] **Resend Email Setup** - Set up Resend for curator application notifications

## STRIPE CONNECT SETUP

### Environment Variables Required
Add to Vercel:
```bash
npx vercel env add STRIPE_SECRET_KEY        # sk_test_... or sk_live_...
npx vercel env add STRIPE_WEBHOOK_SECRET    # whsec_... from Stripe Dashboard
```

### Stripe Dashboard Setup
1. Go to https://dashboard.stripe.com/connect/settings
2. Enable "Express" account type
3. Set branding (logo, colors, etc.)
4. Add redirect URLs:
   - Return URL: `nafisascloset://stripe-return`
   - Refresh URL: `https://nafisasz-closet.vercel.app/api/stripe/connect?refresh=true`

### Webhook Setup
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://nafisasz-closet.vercel.app/api/stripe/webhook`
3. Select events:
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
   - `charge.dispute.created`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### Cron Job (Vercel Pro required for per-minute)
The `/api/cron/check-auctions` endpoint runs every 5 minutes to:
- Find expired auctions with winning bids
- Create transaction records
- Initiate PaymentIntent for winners

Alternative: Use external cron service (cron-job.org) for free tier.

### API Endpoints
- `GET/POST /api/stripe/connect` - Curator onboarding
- `POST /api/stripe/webhook` - Stripe event handler
- `GET /api/transactions` - List user transactions
- `POST /api/transactions/:id/confirm-purchase` - Curator confirms
- `POST /api/transactions/:id/mark-shipped` - Add tracking
- `POST /api/transactions/:id/confirm-delivery` - Buyer confirms, triggers payout

### Resend Email Setup (for curator notifications)
- Create account at https://resend.com
- Add RESEND_API_KEY to Vercel: `npx vercel env add RESEND_API_KEY`
- Verify domain nafisaszcloset.com in Resend (or use onboarding@resend.dev for testing)
- Curator applications will email nafisasz@gmail.com

## UX TERMINOLOGY RULES

**IMPORTANT: Never use these terms in the UI:**
- "Auction" → Use "Post" or "Listing" instead
- "Bid" → Use "Claim" instead
- "Bidding" → Use "Claiming" instead
- "Bidder" → Use "Claimer" instead

**Color Scheme:**
- Background: Deep purple (#1A0A2E)
- Surface: Lighter purple (#2D1B4E)
- Text: White (#FFFFFF)
- Accent: Red (#E63946)

## WHAT WE'RE BUILDING

A live luxury treasure hunt platform where Style Curators discover unique fashion pieces in boutiques worldwide and share them via timed posts.

### The Core Flow
1. **Curator** finds an item in a boutique (Paris, Tokyo, Milan, etc.)
2. **Curator** posts item with photos, details, retail price
3. **Platform** auto-calculates starting bid (retail × 1.20)
4. **Curator** sets auction window (30 min to 24 hours)
5. **Buyers** bid in real-time (competitive bidding)
6. **Timer** extends +2 min if bid placed in last 2 minutes
7. **Winner** auto-charged when timer expires
8. **Curator** purchases item, ships within 48 hours
9. **Platform** releases funds after delivery confirmation

### Why This Exists
- **For Curators:** Turn shopping passion into income, build following
- **For Buyers:** Access to unique pieces from global fashion capitals, curated by trusted taste-makers
- **For Platform:** Commission + subscription revenue

## BUSINESS MODEL

### Revenue Streams
1. **Transaction Commission:** 5-10% per sale (tiered by subscription)
2. **Curator Subscriptions:**
   - Free: 10% platform fee, max 10 listings/month
   - Pro ($29/mo): 7% platform fee, unlimited listings
   - Elite ($99/mo): 5% platform fee, featured placement, verified badge
3. **Bidding War Premium:** 25% of amount above starting bid
4. **Future:** VIP Buyer subscription ($19/mo for early access)

### Unit Economics (Example)
- Item retail price: $500
- Starting bid: $600 (retail + 20%)
- Final bid after competition: $650
- **Curator earns:** ~$50 base + $37.50 premium = $87.50
- **Platform earns:** ~$50 base + $12.50 premium = $62.50
- **Buyer pays:** $650

### Target Markets
**Phase 1:** USA, UK, France, Canada  
**Phase 2:** UAE, Saudi Arabia, Japan

## TECHNICAL STACK

### Mobile App
- React Native + Expo (SDK 50+)
- TypeScript
- Expo Router (navigation)
- Zustand (state management)
- React Query (data fetching)
- Socket.io client (real-time bidding)
- Expo Push Notifications
- Expo Image Picker

### Backend
- Node.js 20+ with Express
- TypeScript
- PostgreSQL 15+ with Prisma ORM
- Redis (caching + real-time)
- Socket.io server
- JWT authentication
- Multer (file uploads)

### Third-Party Services
- **Payments:** Stripe Connect (marketplace payments)
- **Shipping:** Shippo or EasyPost
- **Storage:** AWS S3 (images)
- **Email:** SendGrid or AWS SES
- **Push:** Expo Push Service
- **Monitoring:** Sentry

### Infrastructure
- **Hosting:** Oracle Cloud (free tier) or Railway/AWS
- **Database:** PostgreSQL (managed or self-hosted)
- **Redis:** Redis Cloud (free tier)

## KEY FEATURES (MVP)

### Curator Features
- Post items (photos, details, retail price, auction duration)
- View active/sold listings
- Accept sale when auction ends
- Upload receipt (for reimbursement)
- Generate shipping label
- Mark as shipped
- In-app messaging with buyers
- Earnings dashboard
- Stripe Connect onboarding

### Buyer Features
- Browse Infinity Feed (all active listings)
- Follow curators
- View listing details with live timer
- Place bids
- Real-time bid updates
- Auto-charge on win
- Track orders
- Confirm delivery
- Message curators
- View bid history

### Admin Features
- Approve/suspend curators
- View all transactions
- Resolve disputes
- Platform analytics

## DATABASE SCHEMA (Core Tables)

### users
- id, email, password_hash, role, name, profile_photo, bio
- Roles: 'curator', 'buyer', 'admin'

### curators
- user_id (FK), subscription_tier, health_score, total_sales
- on_time_shipping_rate, rating, approved, stripe_account_id

### listings
- id, curator_id (FK), title, description, brand, size
- retail_price, starting_bid, current_high_bid, high_bidder_id
- photos[], status, auction_start, auction_end
- returns_allowed, local_pickup_available

### bids
- id, listing_id (FK), bidder_id (FK), bid_amount, is_winning

### transactions
- id, listing_id (FK), buyer_id (FK), curator_id (FK)
- final_price, platform_fee, curator_earnings
- payment_intent_id, status, receipt_url, tracking_number

### follows
- follower_id (FK), curator_id (FK)

### messages
- listing_id (FK), sender_id (FK), receiver_id (FK)
- message_text, read, created_at

### notifications
- user_id (FK), type, title, body, data (JSONB), read

## API STRUCTURE

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Listings
- `GET /api/listings` - Get all active (Infinity Feed)
- `GET /api/listings/:id` - Get single listing
- `POST /api/listings` - Create listing (curator)
- `PUT /api/listings/:id` - Update listing (curator)

### Bidding
- `POST /api/bids` - Place bid
- `GET /api/bids/my-bids` - User's bids
- `GET /api/bids/winning` - Current winning bids

### Transactions
- `POST /api/transactions/:id/confirm-purchase` - Curator confirms
- `POST /api/transactions/:id/generate-label` - Generate shipping
- `POST /api/transactions/:id/mark-shipped` - Mark shipped
- `POST /api/transactions/:id/confirm-delivery` - Buyer confirms

### Curators
- `GET /api/curators` - List all curators
- `POST /api/curators/:id/follow` - Follow curator
- `DELETE /api/curators/:id/follow` - Unfollow

### Payments
- `POST /api/payments/create-connect-account` - Stripe Connect
- `POST /api/payments/create-payment-intent` - Charge winner

## CRITICAL BUSINESS LOGIC

### Auction Timer Logic
```
1. Auction starts when listing posted
2. Timer counts down to auction_end
3. If bid placed within last 2 minutes:
   - Extend auction_end by 2 minutes
   - Max 3 extensions per auction
4. When timer hits 0:
   - Mark listing as 'sold'
   - Create transaction record
   - Auto-charge winner via Stripe
   - Notify curator to purchase
   - Notify winner
```

### Starting Bid Calculation
```
starting_bid = retail_price × 1.20
```
This covers:
- 10% curator margin
- 10% platform fee
(Actual splits adjust based on subscription tier)

### Platform Fee Calculation
```
Curator Tier -> Platform Fee
Free         -> 10%
Pro ($29/mo) -> 7%
Elite ($99/mo) -> 5%
```

### Bidding War Premium Split
```
premium = final_bid - starting_bid
curator_gets = premium × 0.75
platform_gets = premium × 0.25
```

### Health Score Calculation
```
Health Score (0-100) =
  - Customer ratings (40%)
  - On-time shipping rate (30%)
  - Item accuracy (20%)
  - Response time (10%)

If score < 70: Warning
If score < 50: 30-day suspension
If score < 30: Permanent ban
```

## PAYMENT FLOW (Stripe Connect)

### Setup (One-Time)
1. Curator signs up
2. Curator creates Stripe Connect account
3. Curator completes onboarding (bank details, verification)
4. Curator approved, can start posting

### Per Transaction
1. Buyer wins auction
2. Platform creates Payment Intent (charges buyer)
3. Funds held in platform Stripe account
4. Curator purchases item, uploads receipt
5. Curator generates label, ships item
6. Buyer confirms delivery (or auto-confirm after 7 days)
7. Platform creates Transfer to curator's Stripe account
8. Curator receives payout

### Fees
- Stripe charges platform: 2.9% + $0.30
- Platform absorbs this (baked into commission)

## SHIPPING FLOW (Shippo/EasyPost)

### Domestic (Same Country)
- Flat rate: $15 standard, $25 express
- Curator pays upfront, gets reimbursed

### Continental (US↔Canada, UK↔France)
- Flat rate: $30 standard, $50 express

### International (Cross-Atlantic)
- Buyer pays actual cost (calculated at checkout)

### Process
1. Transaction created (buyer won)
2. Curator confirms purchase
3. Curator clicks "Generate Label"
4. Platform calls Shippo API with:
   - From: Curator address
   - To: Buyer address
   - Weight/dimensions (curator inputs)
   - Service level (standard/express)
5. Shippo returns label URL + tracking number
6. Platform stores label_url, tracking_number in transaction
7. Curator downloads label, prints, ships
8. Tracking auto-updates buyer

## REAL-TIME BIDDING (Socket.io)

### Events

#### Server → Client
- `bid:new` - New bid placed on listing
  ```json
  {
    "listingId": "uuid",
    "bidAmount": 650,
    "bidderName": "Sarah M.",
    "isWinning": true,
    "currentHighBid": 650
  }
  ```

- `auction:extended` - Timer extended
  ```json
  {
    "listingId": "uuid",
    "newEndTime": "2024-01-15T14:32:00Z",
    "extensionsLeft": 2
  }
  ```

- `auction:ended` - Auction ended
  ```json
  {
    "listingId": "uuid",
    "winnerId": "uuid",
    "finalPrice": 675
  }
  ```

#### Client → Server
- `listing:subscribe` - Start watching listing
  ```json
  {
    "listingId": "uuid"
  }
  ```

- `listing:unsubscribe` - Stop watching
  ```json
  {
    "listingId": "uuid"
  }
  ```

### Connection Pattern
```
User opens listing detail
  → Client emits 'listing:subscribe'
  → Server adds user to room `listing:{id}`
  → User receives real-time updates

User leaves screen
  → Client emits 'listing:unsubscribe'
  → Server removes user from room
```

## NOTIFICATION TRIGGERS

### Push Notifications (High Priority)
- New listing from followed curator
- Outbid on a listing
- Won an auction
- Item shipped (with tracking)
- Delivery reminder (if not confirmed after 3 days)
- Payment received (curator)

### In-App Notifications (Lower Priority)
- New follower (curator)
- New message
- Listing expired (curator)
- Low health score warning (curator)

### Email (Backup)
- Welcome email
- Transaction receipt
- Weekly digest (curated items)

## SECURITY & VALIDATION

### Input Validation (All User Inputs)
```typescript
// Use Zod for schema validation
import { z } from 'zod';

const createListingSchema = z.object({
  title: z.string().min(5).max(255),
  description: z.string().max(2000).optional(),
  brand: z.string().max(255).optional(),
  size: z.string().max(50).optional(),
  retailPrice: z.number().positive().max(50000),
  auctionDuration: z.enum(['30m', '2h', '6h', '24h']),
  returnsAllowed: z.boolean().default(false),
  localPickupAvailable: z.boolean().default(false),
});
```

### Authentication
- JWT tokens (15 min access, 7 day refresh)
- Refresh tokens in httpOnly cookies
- bcrypt password hashing (12 rounds)
- Rate limiting: 5 failed login attempts = 15 min lockout

### Authorization
```typescript
// Middleware examples
const requireAuth = (req, res, next) => {
  // Verify JWT token
};

const requireCurator = (req, res, next) => {
  // Check user.role === 'curator'
};

const requireAdmin = (req, res, next) => {
  // Check user.role === 'admin'
};

const requireOwnership = (req, res, next) => {
  // Check user owns the resource
};
```

### Payment Security
- Never store credit card data
- Use Stripe hosted forms
- Verify all amounts server-side
- Validate webhook signatures from Stripe

## UI/UX PRINCIPLES

### Design Philosophy
- **Elegant Simplicity:** Clean, uncluttered
- **Speed:** Fast load times, optimistic updates
- **Trust:** Professional design, clear communication
- **Delight:** Smooth animations, satisfying micro-interactions

### Color Palette (Temporary)
- **Primary:** Black (#000000)
- **Secondary:** Warm Gray (#F5F5F5)
- **Accent:** Rose Gold (#B76E79)
- **Success:** Green (#10B981)
- **Warning:** Amber (#F59E0B)
- **Error:** Red (#EF4444)

### Typography
- **Headings:** SF Pro Display (iOS) / Roboto (Android)
- **Body:** SF Pro Text / Roboto
- **Sizes:** 
  - H1: 32px
  - H2: 24px
  - H3: 20px
  - Body: 16px
  - Small: 14px

### Key Animations
- **Feed scroll:** Smooth 60fps
- **Bid button:** Pulse effect when near timer end
- **Timer:** Smooth countdown, urgency color shift (green → yellow → red)
- **Bid placement:** Optimistic update + celebration animation on success

### Loading States
- Skeleton loaders for content (not spinners)
- Optimistic updates for user actions
- Pull-to-refresh on feed

## TESTING STRATEGY

### Unit Tests (Jest)
- Bid calculation logic
- Timer extension logic
- Platform fee calculation
- Health score calculation

### Integration Tests (Supertest)
- API endpoints
- Authentication flow
- Payment processing (Stripe test mode)

### E2E Tests (Detox)
- Register → Browse → Bid → Win flow
- Curator post → Auction → Ship flow

### Manual Testing Checklist
- [ ] iOS devices (iPhone 12+, iPad)
- [ ] Android devices (Pixel, Samsung)
- [ ] Slow network (throttled)
- [ ] Interrupted flows (app background/foreground)
- [ ] Edge cases (auction ends while offline, etc.)

## METRICS TO TRACK

### Product Health
- **GMV:** Total value sold
- **Sell-Through Rate:** % of listings that sell
- **Average Order Value:** Total GMV / Transactions
- **Conversion Rate:** Listings with bids / Total listings

### User Engagement
- **DAU/MAU:** Daily / Monthly active users
- **Session Length:** Avg time in app
- **Bid Participation:** Unique bidders / Listing views
- **Repeat Purchase Rate:** Users with 2+ purchases

### Operational
- **On-Time Shipping:** % shipped within 48 hours
- **Dispute Rate:** Disputes / Transactions
- **Health Score:** Avg curator health score

### Financial
- **MRR:** Monthly recurring revenue (subscriptions)
- **Transaction Revenue:** Commission revenue
- **Take Rate:** Platform revenue / GMV

## EDGE CASES TO HANDLE

### Auction Edge Cases
- User bids while offline (reject, notify)
- Auction ends while user viewing (graceful update)
- Two bids placed simultaneously (handle race condition)
- Curator deletes listing with active bids (prevent or refund)

### Payment Edge Cases
- Credit card declined (notify, allow retry)
- Stripe webhook delayed (retry logic)
- Curator doesn't purchase item (refund buyer, ban curator)
- Buyer disputes charge (hold curator payout, investigate)

### Shipping Edge Cases
- Item lost in transit (insurance claim, refund buyer)
- Buyer doesn't confirm delivery (auto-confirm after 7 days)
- Incorrect address (allow buyer to update, curator re-ship)

## FUTURE FEATURES (Not MVP)

### Phase 3 (Post-Launch)
- Hunt Stories (video posts from boutiques)
- Squad Bidding (group purchases)
- Mystery Boxes (surprise curated items)
- Global Drop Events (coordinated launches)
- Curator Takeovers (featured days)
- AI Style Recommendations
- VIP Buyer subscription

### International Expansion
- Middle East (Dubai, Saudi Arabia)
- Japan (Tokyo)
- Australia (Sydney)

## DEVELOPMENT WORKFLOW

### Git Branching
```
main (production)
  ↑
develop (staging)
  ↑
feature/xyz (your work)
```

### Commit Messages
```
feat: add bid placement functionality
fix: resolve timer extension bug
refactor: simplify listing card component
docs: update API documentation
test: add tests for payment flow
```

### Code Review Checklist
- [ ] Code follows TypeScript best practices
- [ ] No console.logs in production code
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Types defined (no `any`)
- [ ] Comments for complex logic
- [ ] Tests written (if applicable)

### Deployment
- **Staging:** Merge to `develop` → Auto-deploy
- **Production:** Merge to `main` → Manual deploy after testing

## ENVIRONMENT VARIABLES

### Backend (.env)
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/nafisas_closet
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=nafisas-closet-images

# Shippo
SHIPPO_API_KEY=...

# SendGrid
SENDGRID_API_KEY=...
FROM_EMAIL=noreply@nafisaszcloset.com

# Expo
EXPO_PUSH_TOKEN=...
```

### Mobile App (.env)
```bash
API_URL=http://localhost:3000
SOCKET_URL=http://localhost:3000
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## FOLDER STRUCTURE

### Backend
```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── middleware/       # Auth, validation, etc.
│   ├── models/           # Prisma models
│   ├── utils/            # Helpers
│   ├── socket/           # Socket.io logic
│   ├── config/           # Configuration
│   └── index.ts          # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── tests/
├── .env
└── package.json
```

### Mobile App
```
mobile/
├── app/                  # Expo Router screens
│   ├── (auth)/           # Auth screens
│   ├── (tabs)/           # Main tabs
│   ├── listing/          # Listing screens
│   └── _layout.tsx       # Root layout
├── components/           # Reusable components
├── hooks/                # Custom hooks
├── services/             # API clients
├── stores/               # Zustand stores
├── utils/                # Helpers
├── types/                # TypeScript types
├── constants/            # Colors, sizes, etc.
└── app.json              # Expo config
```

## COMMON TASKS

### Add a New API Endpoint
1. Define route in `routes/`
2. Create controller in `controllers/`
3. Add business logic in `services/`
4. Update Prisma schema if needed
5. Test with Postman
6. Update API docs

### Add a New Screen
1. Create file in `app/` (Expo Router)
2. Add screen component
3. Connect to API via React Query
4. Handle loading/error states
5. Test on iOS and Android

### Update Database Schema
1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Update types/interfaces
4. Update affected queries
5. Test thoroughly

## HELPFUL COMMANDS

### Backend
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (DB GUI)
npx prisma studio

# Run tests
npm test

# Run linter
npm run lint
```

### Mobile App
```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Build for production
eas build --platform all

# Submit to app stores
eas submit
```

## TROUBLESHOOTING

### "Port 3000 already in use"
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

### Expo not connecting to backend
- Check API_URL in .env
- Ensure backend is running
- Check network (use same WiFi)

### Database connection failed
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Run migrations: `npx prisma migrate dev`

### Stripe webhook not working locally
- Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- Update STRIPE_WEBHOOK_SECRET in .env

## SUPPORT RESOURCES

### Documentation
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Socket.io Docs](https://socket.io/docs/v4/)

### Community
- React Native Discord
- Expo Discord
- Stack Overflow
- GitHub Issues

## FINAL NOTES

### Remember
- Ship fast, iterate based on feedback
- Focus on core value prop first
- Don't build features users don't need
- Test with real users early and often
- Security and performance are non-negotiable

### Guiding Principles
1. **Users first:** Build what they need, not what's cool
2. **Quality over quantity:** 10 great features > 100 mediocre ones
3. **Data-driven:** Let metrics guide decisions
4. **Iterate fast:** Release, measure, learn, repeat

**You've got this! Let's build something incredible. 🚀**

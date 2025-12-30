# NAFISA'S CLOSET - PROJECT CONTEXT

## PROJECT IDENTITY
- **Name:** Nafisa's Closet (codename - will rebrand later)
- **Domain:** nafisaszcloset.com (temporary)
- **Version:** 1.0 MVP
- **Type:** Mobile marketplace app (iOS + Android)
- **Stage:** Phase 3 - App Store Preparation
- **Last Updated:** 2025-12-30 (Shippo shipping integration, size field, EAS account migration)
- **API URL:** https://nafisasz-closet.vercel.app (cloud-deployed)
- **GitHub:** https://github.com/raynmakr/nafisasz-closet
- **EAS Account:** raynmakr-inc (corporate account with paid plan)

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
- [x] Stripe Connect for curator payouts
- [x] Event-driven auction completion (client-triggered, not polling)
- [x] Curator early close auction feature
- [x] Payment intent creation on auction end
- [x] Push notifications (Expo Push)
  - [x] Outbid alerts
  - [x] Payment received (curator)
  - [x] Payment failed (buyer)
  - [x] Item shipped with tracking
  - [x] Dispute alerts (admin)
  - [x] New listing from followed curator
  - [x] New message notification
- [x] Profile Completion - Prompts users to add name/bio if missing
- [x] Edit Listings - Curators can edit draft listings before publishing
- [x] In-app Messaging - Chat between buyer and curator on any listing
- [x] Auto-confirm Delivery - After 7 days if buyer doesn't confirm (cron job)
- [x] Purse & Gold Coins System - Premium loyalty rewards
  - [x] Currency rates locked at January 2026 gold prices (USD, GBP, EUR, CAD, AED)
  - [x] Earning: Welcome bonus (6 GC), referrals (11 GC), purchase milestones, curator milestones, engagement rewards
  - [x] Spending: Apply coins at checkout (min 2 GC, max 50% discount)
  - [x] Gifting: Send 1-11 GC to friends (5 gifts/month, 55 GC/month max)
  - [x] Mobile UI: Purse screen, balance widget, checkout coin slider, gift screen
- [x] Payment Screen - Stripe PaymentSheet for winners to complete payment
  - [x] API endpoint for payment sheet params (`/api/transactions/payment-sheet`)
  - [x] Mobile payment service with `getPaymentSheetParams()`
  - [x] Payment screen at `/mobile/app/payment/[transactionId].tsx`
  - [x] StripeProvider integrated in app layout
  - [x] "Pay Now" prompt when user wins auction on listing detail
  - [x] "Pay Now" badge in Activity claims tab for pending payments
- [x] Payment Method Authorization - Require saved card before claiming
  - [x] Database: Added `stripe_customer_id` and `default_payment_method_id` to users
  - [x] API: `/api/payment-methods` - GET status, DELETE remove
  - [x] API: `/api/payment-methods/setup` - Create SetupIntent
  - [x] API: `/api/payment-methods/confirm` - Save payment method
  - [x] Mobile: Add Payment Method screen (`/add-payment-method`)
  - [x] Mobile: Block claims if no payment method saved
  - [x] Auto-charge winner's saved card when auction ends
- [x] Pre-Authorization on Claims - Hold funds when claim is placed
  - [x] Database: Added `payment_intent_id` to bids table
  - [x] API: Pre-auth created when claim is placed (capture_method: manual)
  - [x] API: Pre-auth canceled when user is outbid
  - [x] API: Pre-auth captured when auction ends (instead of new charge)
  - [x] Cron: Safety-net updated to capture pre-auth
- [x] Order History UI - Track purchases and sales
  - [x] Mobile: Orders list screen (`/orders`) with Purchases/Sales tabs
  - [x] Mobile: Order detail screen (`/order/[id]`) with timeline
  - [x] Buyer actions: Pay Now, Confirm Delivery, Track Package
  - [x] Seller actions: Confirm Purchase, Add Tracking & Ship
  - [x] Profile: Orders menu item added
- [x] Purse Checkout Integration - Apply Gold Coins at payment
  - [x] Payment screen coin discount slider
  - [x] API: `/api/checkout/coin-preview` - Preview discount
  - [x] API: `/api/checkout/apply-coins` - Apply coins and update payment intent
  - [x] Database: Added coins_applied, coin_discount columns to transactions
- [x] Purse Earning Triggers - Auto-award coins for milestones
  - [x] Welcome bonus (6 GC) on new user signup
  - [x] Referral signup bonus (6 GC) when signing up via referral link
  - [x] Referral reward (11 GC) when referred user makes first purchase
  - [x] Buyer milestones (2-7 GC) on 1st, 3rd, 5th, 10th purchase
  - [x] Curator milestones (7-67 GC) on 1st, 10th, 50th sale
  - [x] Curator follower milestone (14 GC) on reaching 100 followers
  - [x] Engagement rewards (1 GC each) for profile completion, photo upload, enabling notifications
  - [x] Birthday rewards cron (2 GC) - daily job awards coins during user's birthday month
- [x] Resend Email Notifications
  - [x] Email utility module (lib/email.js)
  - [x] Curator application notification to admin
  - [x] Curator welcome email on approval
  - [x] Transaction receipt email (ready, not yet triggered)
- [x] Hunt Stories - Video posts from curators
  - [x] Database schema (hunt_stories, story_views tables)
  - [x] Stories API (/api/stories.js) - CRUD + view tracking
  - [x] Video upload support in /api/upload.js
  - [x] Cleanup cron job (daily at midnight)
  - [x] Mobile: StoryCircles component (Instagram-style circles)
  - [x] Mobile: StoryViewer component (full-screen video player)
  - [x] Mobile: Story creation screen (/story/create)
  - [x] Mobile: Stories integrated at top of Discover feed
  - [x] Stories expire after 7 days
  - [x] Only curators can post stories
- [x] EAS Build Setup - iOS development builds
  - [x] eas.json with development, development-device, preview, production profiles
  - [x] Square app icons (1024x1024)
  - [x] expo-notifications plugin configured
  - [x] Stripe React Native SDK (v0.50.3 - Expo SDK 54 compatible)
  - [x] APNs key configured for push notifications
  - [x] Successful iOS simulator build
  - [x] Physical device builds via Xcode
- [x] Invitation/Referral System
  - [x] API: `/api/user/invitation` - Get user's invite code
  - [x] API: `/api/invitation/validate` - Validate invite codes
  - [x] Mobile: Invite friends screen with shareable code/link
- [x] Shipping Integration (Shippo) - In Test Mode
  - [x] Shippo API integration (`lib/shippo.js`)
  - [x] Address validation API
  - [x] Shipping rates API (`/api/shipping/rates`)
  - [x] Label purchase API (`/api/shipping/label`) - working in test mode
  - [x] Tracking API (`/api/shipping/track`)
  - [x] Mobile: Shipping address management (`/addresses`, `/address/[id]`)
  - [x] Mobile: Shipping label flow (`/shipping/[transactionId]`)
  - [x] Phone and email now required for addresses (USPS requirement)
  - [x] Friendly error messages for common Shippo errors
  - [ ] Switch to live Shippo API key for production
- [x] Post Creation Improvements
  - [x] Size field added with common sizes (XS-XXL, numeric, One Size)
  - [x] Horizontal scroll size selector with tap-to-select
  - [x] Custom size text input for non-standard sizes

### Known Issues
- [ ] Domain nafisaszcloset.com not fully configured (Wix DNS conflict)
- [ ] Push token registration may fail on first launch (non-blocking)

## NEXT STEPS

### Immediate Priority
1. **Shipping - Go Live**
   - [x] Shippo API integration complete (test mode working)
   - [x] Addresses require phone/email (USPS requirement)
   - [ ] Get live Shippo API key (`shippo_live_...`)
   - [ ] Add payment method to Shippo account for label purchases
   - [ ] Update SHIPPO_API_KEY in Vercel with live key
   - [ ] Test full label purchase flow with real carriers

2. **Stripe Integration Completion**
   - [x] Stripe Connect onboarding URL fix (now uses web redirects)
   - [ ] Test full payment flow end-to-end on physical device
   - [ ] Verify pre-authorization capture on auction end
   - [ ] Test Stripe Connect curator payouts
   - [ ] Configure production Stripe keys
   - [ ] Set up Stripe webhooks for production

3. **Mobile App Updates Pending TestFlight**
   - [ ] Size field on post creation form (code ready, needs build)
   - [ ] Phone/email required on address form (code ready, needs build)
   - Build command: `cd mobile && npx eas build --profile preview --platform ios`
   - Submit command: `npx eas submit --platform ios --latest`

### App Store Submission
4. **TestFlight / App Store**
   - [x] Build with `preview` profile for TestFlight
   - [x] EAS account migrated to raynmakr-inc (paid plan)
   - [ ] Beta testing with internal testers
   - [ ] App Store screenshots and metadata
   - [ ] Privacy policy and terms of service
   - [ ] Production release

### Future
5. **VIP Buyer Subscription** - Early access to listings ($19/mo) - DEFERRED

## EAS BUILD COMMANDS

### Development (iOS Simulator)
```bash
cd mobile
npx eas build --profile development --platform ios
```

### Development (Physical Device)
```bash
npx eas build --profile development-device --platform ios
# Requires Apple Developer credentials - will prompt for login
```

### TestFlight (Beta Testing)
```bash
npx eas build --profile preview --platform ios
npx eas submit --platform ios --latest
```

### Production (App Store)
```bash
npx eas build --profile production --platform ios
npx eas submit --platform ios --latest
```

### Device Registration
```bash
npx eas device:create    # Register single device
npx eas device:list      # List registered devices
```

### Local Development
```bash
npx expo start --dev-client   # Start Metro for development builds
```

## TODO / PENDING SETUP
- [x] **Stripe Connect** - Marketplace payments for curators (implemented)
- [x] **Push Notifications** - Expo Push for real-time alerts (implemented)
- [x] **Event-Driven Auctions** - Client-triggered completion replaces polling (implemented)
- [x] **Purse & Gold Coins** - Loyalty rewards system (implemented)
- [x] **CRON_SECRET** - Added to Vercel environment (production, preview, development)
- [x] **Resend Email Setup** - Email notifications (requires RESEND_API_KEY in Vercel)
- [x] **EAS Build** - iOS builds configured (development, preview, production profiles)
- [x] **Shippo Shipping** - Label generation API (test mode working, needs live key)

## SHIPPO SHIPPING SETUP

### Current Status
- **API Key:** Test mode (`shippo_test_...`) - labels are void/test only
- **Carriers Enabled:** USPS, UPS, Canada Post (via Shippo accounts)

### Environment Variables
```bash
npx vercel env add SHIPPO_API_KEY   # shippo_test_... or shippo_live_...
```

### To Go Live
1. Go to https://apps.goshippo.com/settings/api
2. Copy your **Live Token** (starts with `shippo_live_`)
3. Add payment method at https://apps.goshippo.com/settings/billing
4. Update Vercel:
   ```bash
   npx vercel env rm SHIPPO_API_KEY --yes
   npx vercel env add SHIPPO_API_KEY  # paste live key
   ```

### API Endpoints
- `GET/POST /api/shipping/addresses` - User address CRUD
- `POST /api/shipping/validate` - Validate address with Shippo
- `POST /api/shipping/rates` - Get shipping rates for transaction
- `POST /api/shipping/label` - Purchase shipping label
- `GET /api/shipping/track` - Get tracking info
- `POST /api/shipping/quick-estimate` - Quick rate estimate by ZIP

### Requirements for Label Purchase
- **USPS requires:** Phone AND email on both sender and recipient addresses
- **Addresses must be different:** Cannot ship to same address (buyer ≠ seller)
- **Rates expire:** ~1-2 hours after fetching, must get fresh rates

## TEST DATA

### Test Users
| User | Email | Role | Address |
|------|-------|------|---------|
| KC Daya | me@qdaya.com | curator | 854 Longfellow Ave, Mississauga ON |
| Sophie Chen | sophiefinds@test.nafisascloset.com | buyer | 100 Queen St W, Toronto ON |

### Test Transactions
| TX ID | Buyer | Curator | Status | Amount |
|-------|-------|---------|--------|--------|
| 3 | Sophie Chen | KC Daya | paid | $5,800 |

Use Transaction #3 to test shipping label flow (different addresses).

## STRIPE CONNECT SETUP

### Environment Variables Required
Add to Vercel:
```bash
npx vercel env add STRIPE_SECRET_KEY        # sk_test_... or sk_live_...
npx vercel env add STRIPE_PUBLISHABLE_KEY   # pk_test_... or pk_live_...
npx vercel env add STRIPE_WEBHOOK_SECRET    # whsec_... from Stripe Dashboard
```

Add to mobile `.env` for Expo:
```bash
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
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

### Auction Completion (Event-Driven)
Auctions complete via **client-triggered events**, not polling:

1. **Primary:** When any viewer's timer hits zero, their app calls `POST /api/listings/complete`
2. **Curator Early Close:** Curator can close auction anytime via same endpoint
3. **Safety Net:** Hourly cron (`/api/cron/check-auctions`) catches missed auctions (expired >5 min ago)

The cron job runs **hourly** (not every 5 minutes) as a backup only.

**Benefits:**
- Instant completion (vs up to 5 min delay)
- ~288 → ~24 API calls/day
- Payment intent created immediately

### API Endpoints
- `GET/POST /api/stripe/connect` - Curator onboarding
- `POST /api/stripe/webhook` - Stripe event handler
- `POST /api/listings/complete` - Client-triggered auction completion
- `GET /api/transactions` - List user transactions
- `POST /api/transactions/:id/confirm-purchase` - Curator confirms
- `POST /api/transactions/:id/mark-shipped` - Add tracking (sends notification)
- `POST /api/transactions/:id/confirm-delivery` - Buyer confirms, triggers payout
- `POST /api/user` with `action: register-push-token` - Register Expo push token

### Push Notifications Setup (Implemented)
Push notifications use Expo Push Service. Key files:

**Backend:**
- `/lib/notifications.js` - Send push notifications via Expo Push API
- `/api/user.js` - Register push tokens (`action: register-push-token`)
- `/api/stripe/webhook.js` - Sends notifications on payment events
- `/api/bids.js` - Sends outbid notifications
- `/api/transactions.js` - Sends shipped notifications

**Mobile:**
- `/mobile/hooks/usePushNotifications.ts` - Request permission, get token, register with backend
- `/mobile/app/_layout.tsx` - PushNotificationHandler initializes on app start

**Database:**
- `users.push_token` - Stores Expo push token per user
- `notifications` table - Stores in-app notifications

**Testing:** Push notifications only work on physical devices, not simulators.

### Resend Email Setup (Implemented)
Email notifications use Resend. Key files:

**Backend:**
- `/lib/email.js` - Email utility with Resend integration
- `/api/curators.js` - Sends curator application & welcome emails
- `/api/user.js` - Sends curator application email (become-curator action)

**Email Types:**
- Curator application notification to admin
- Curator welcome email on approval
- Transaction receipt (ready, hook into payment flow)

**Setup:**
1. Create account at https://resend.com
2. Add RESEND_API_KEY to Vercel: `npx vercel env add RESEND_API_KEY`
3. (Optional) Verify domain nafisaszcloset.com in Resend
4. (Optional) Add ADMIN_EMAIL to Vercel (defaults to nafisasz@gmail.com)
5. (Optional) Add FROM_EMAIL to Vercel (defaults to onboarding@resend.dev)

**Note:** If RESEND_API_KEY is not set, emails are skipped with a console log.

## UX TERMINOLOGY RULES

**IMPORTANT: Never use these terms in the UI:**
- "Auction" → Use "Post" or "Listing" instead
- "Bid" → Use "Claim" instead
- "Bidding" → Use "Claiming" instead
- "Bidder" → Use "Claimer" instead

**PRIVACY: Never expose user names in the app UI:**
- Always display @handle instead of user's real name
- Profile photos with @handle only - no names visible
- Curators identified by @handle on listings, chat, search results
- Letter avatars should use first letter of handle (not name)
- Exception: User's own profile settings page may show their name for editing

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

## PURSE & GOLD COINS SYSTEM

### Overview
The Purse is our premium loyalty rewards system where members collect Gold Coins. Each coin represents real gold value, locked at the January 2026 Gold Standard. Coins can be earned, gifted (limited), and spent to subsidize purchases on the platform.

### Gold Standard Valuation (January 2026)

**Core Principle:** 1 Gold Coin = 1/1000th troy ounce of gold

**Locked Rates (Never change):**
- 🇺🇸 USA: 1 GC = $4.50 USD (gold: $4,534/oz)
- 🇬🇧 UK: 1 GC = £3.50 GBP (gold: £3,580/oz)
- 🇫🇷 France: 1 GC = €4.00 EUR (gold: €4,280/oz)
- 🇨🇦 Canada: 1 GC = $6.00 CAD (gold: C$6,350/oz)
- 🇦🇪 UAE: 1 GC = 15.00 AED (gold: 16,650 AED/oz)

These rates are FIXED. They do not fluctuate with daily gold prices or exchange rates.

### Earning Gold Coins

**Philosophy:** Tiered reduction model
- Referrals: Moderate rewards (50% reduction from original)
- Buyers: Lower rewards (60-70% reduction) - easier to acquire
- Curators: Higher rewards (30-40% reduction) - critical supply side
- Engagement: Minimal rewards (50% reduction)

#### Referral Rewards
```javascriptreferral_successful: 11 GC      // $49.50 value - when friend makes first purchase
referral_signup_bonus: 6 GC     // $27 value - friend's welcome bonus

#### Buyer Milestone Rewards
```javascriptfirst_purchase: 2 GC            // $9.00 value
third_purchase: 3 GC            // $13.50 value
fifth_purchase: 4 GC            // $18.00 value
tenth_purchase: 7 GC            // $31.50 value
birthday_month: 2 GC            // $9.00 value (auto-awarded)

#### Curator Milestone Rewards
```javascriptcurator_first_sale: 7 GC         // $31.50 value
curator_10_sales: 28 GC          // $126.00 value
curator_50_sales: 67 GC          // $301.50 value
curator_100_followers: 14 GC     // $63.00 value
curator_high_rating_90days: 20 GC // $90.00 value (4.8+ rating maintained)

#### Engagement Rewards
```javascriptcomplete_profile: 1 GC           // $4.50 value
connect_instagram: 1 GC          // $4.50 value
write_review: 1 GC               // $4.50 value (per review)
upload_profile_photo: 1 GC       // $4.50 value
enable_notifications: 1 GC       // $4.50 value
welcome_bonus: 6 GC              // $27.00 value (auto-awarded on signup)

### Spending Gold Coins

**Rules:**
- Minimum redemption: 2 GC ($9.00 minimum discount)
- Maximum per transaction: 50% of item price
- Applied at checkout to reduce total amount due
- Must always pay some cash (to maintain revenue flow)

**Example:**
- Item price: $500
- User applies 55 GC (55 × $4.50 = $247.50)
- But max 50% = $250 allowed
- Actual discount: $247.50 (55 GC used)
- User pays: $252.50

### Gifting Gold Coins

**Rules (to avoid money transmission issues):**
- Max per gift: 11 GC ($49.50 value)
- Max gifts per month: 5 gifts
- Max monthly total: 55 GC ($247.50 value)
- Recipient must be verified registered user
- Platform monitors for circular gifting patterns (fraud prevention)
- Abuse results in suspension and coin forfeiture

**Use Case:**
- Birthday gifts to friends
- Thank you bonuses between buyers and curators
- Welcome gifts to new members

### Database Schema

#### Currency Rates Table
```sqlCREATE TABLE currency_rates (
currency VARCHAR(3) PRIMARY KEY,
coin_value DECIMAL(10,4) NOT NULL,
symbol VARCHAR(10) NOT NULL,
gold_price_at_launch DECIMAL(10,2),
gold_basis_text TEXT,
locked_date DATE NOT NULL,
last_reviewed DATE,
created_at TIMESTAMP DEFAULT NOW()
);-- January 2026 locked rates
INSERT INTO currency_rates VALUES
('USD', 4.50, '$', 4534.00, 'Based on gold at $4,534/oz (January 2026)', '2026-01-15', '2026-01-15', NOW()),
('GBP', 3.50, '£', 3580.00, 'Based on gold at £3,580/oz (January 2026)', '2026-01-15', '2026-01-15', NOW()),
('EUR', 4.00, '€', 4280.00, 'Based on gold at €4,280/oz (January 2026)', '2026-01-15', '2026-01-15', NOW()),
('CAD', 6.00, 'C$', 6350.00, 'Based on gold at C$6,350/oz (January 2026)', '2026-01-15', '2026-01-15', NOW()),
('AED', 15.00, 'AED', 16650.00, 'Based on gold at 16,650 AED/oz (January 2026)', '2026-01-15', '2026-01-15', NOW());

#### Users Table (Add Columns)
```sqlALTER TABLE users ADD COLUMN gold_coins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN coins_lifetime_earned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE users ADD COLUMN country_code VARCHAR(2);

#### Coin Transactions Table
```sqlCREATE TABLE coin_transactions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
type VARCHAR(50) NOT NULL, -- 'earned', 'spent', 'gifted', 'received'
amount INTEGER NOT NULL,
source VARCHAR(100), -- 'referral', 'first_purchase', 'gift_from_user_123', etc.
related_user_id UUID REFERENCES users(id), -- for gifts
related_listing_id UUID REFERENCES listings(id), -- for spending
balance_after INTEGER NOT NULL,
created_at TIMESTAMP DEFAULT NOW(),INDEX idx_user_transactions (user_id, created_at),
INDEX idx_transaction_type (type, created_at)
);

#### Gift Cards Table
```sqlCREATE TABLE gift_cards (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
amount INTEGER NOT NULL,
status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'claimed', 'expired'
message TEXT,
created_at TIMESTAMP DEFAULT NOW(),
claimed_at TIMESTAMP,
expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),INDEX idx_recipient_gifts (recipient_id, status),
CONSTRAINT chk_amount CHECK (amount > 0 AND amount <= 11)
);

#### Gifting Limits Table
```sqlCREATE TABLE gifting_limits (
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
month DATE NOT NULL, -- First day of month (e.g., '2026-01-01')
gifts_sent INTEGER DEFAULT 0,
total_amount_sent INTEGER DEFAULT 0,
PRIMARY KEY (user_id, month),CONSTRAINT chk_monthly_limits CHECK (
gifts_sent <= 5 AND
total_amount_sent <= 55
)
);

### API Endpoints

#### Purse ManagementGET  /api/purse/balance
Returns: { coins, currency, value, valueUSD }GET  /api/purse/transactions?page=1&limit=20
Returns: Paginated transaction historyPOST /api/purse/gift
Body: { recipientId, amount, message }
Creates gift card (enforces monthly limits)POST /api/purse/claim/:giftCardId
Claims a gift card sent to the user

#### Checkout IntegrationPOST /api/checkout/apply-coins
Body: { listingId, coinsToApply }
Validates and applies coins to purchase
Returns: { discount, finalPrice, coinsUsed }

#### AdminPOST /api/admin/purse/award
Body: { userId, amount, reason }
Manually award coins (promotions, corrections)GET  /api/admin/purse/stats
Returns platform-wide coin statistics

### Business Logic - Critical Rules

#### Earning Triggers
```typescript// When to award coins (implement in service layer)// Referrals

User A invites User B (generates unique referral link)
User B signs up via link → User B gets 6 GC immediately
User B makes first purchase → User A gets 11 GC
// Purchase Milestones

Check user's total completed purchases
Award coins based on milestone (1st, 3rd, 5th, 10th)
Only count successful deliveries (status: 'delivered')
// Curator Milestones

Check total successful sales where curator_id = user_id
Award at thresholds: 1, 10, 50 sales
Check follower count: Award at 100 followers
Check rating: If avg rating >= 4.8 for 90+ days, award once
// Engagement

Award once per action type per user
Use flags: profile_complete_coins_awarded, etc.


#### Spending Validation
```typescriptfunction validateCoinSpending(itemPrice, coinsToApply, userBalance, currency) {
const coinValue = getCoinValue(1, currency); // e.g., 4.50 for USD
const minCoins = Math.ceil(9 / coinValue); // Minimum 2 GC ($9)
const maxDiscount = itemPrice * 0.5; // 50% max
const maxCoins = Math.floor(maxDiscount / coinValue);if (coinsToApply < minCoins) {
return { valid: false, error: 'Minimum 2 coins required' };
}if (coinsToApply > userBalance) {
return { valid: false, error: 'Insufficient balance' };
}if (coinsToApply > maxCoins) {
return { valid: false, error: Maximum ${maxCoins} coins allowed (50% of price) };
}return { valid: true, discount: coinsToApply * coinValue };
}

#### Gifting Validation
```typescriptasync function validateGift(senderId, recipientId, amount) {
// Check amount
if (amount < 1 || amount > 11) {
return { valid: false, error: 'Gift must be 1-11 coins' };
}// Check sender balance
const senderBalance = await getUserCoinBalance(senderId);
if (senderBalance < amount) {
return { valid: false, error: 'Insufficient balance' };
}// Check monthly limits
const thisMonth = new Date().toISOString().slice(0, 7) + '-01';
const limits = await getGiftingLimits(senderId, thisMonth);if (limits.gifts_sent >= 5) {
return { valid: false, error: 'Monthly gift limit reached (5 gifts/month)' };
}if (limits.total_amount_sent + amount > 55) {
return { valid: false, error: 'Monthly amount limit reached (55 GC/month)' };
}// Check recipient is valid user
const recipient = await getUser(recipientId);
if (!recipient || recipient.id === senderId) {
return { valid: false, error: 'Invalid recipient' };
}return { valid: true };
}

### Financial Model (Year 1)

**Expected Issuance:**
- Total coins issued: ~226,000 GC
- Total liability: ~$1,001,000 USD equivalent
- Expected redemption (70%): ~$700,700
- Breakage profit (30%): ~$300,300

**Reserve Strategy:**
- Hold 80% of outstanding liability in reserves
- Allocation: 50% GLD (Gold ETF), 30% SGOV (Treasuries), 20% Cash
- Provides 14% safety cushion over expected redemptions

**ROI:**
- Customer acquisition value: $1,500,000
- Retention boost: $300,000
- Higher AOV: $150,000
- Breakage: $300,300
- Total value: $2,250,300
- Net profit: $1,549,600 (221% ROI)

### Marketing Copy

**Brand Story:**
"Each Gold Coin represents 1/1000th of a troy ounce of gold—the universal standard of value for thousands of years. We locked in this premium rate at launch in January 2026. Your Gold Coins will never lose value. Your Purse only grows."

**Key Messaging:**
- "This isn't just points—it's gold in your pocket"
- "Collect real gold with every purchase"
- "Build your fortune, one coin at a time"
- "Gold Standard Value—Locked Forever"

### Security & Fraud Prevention

**Monitor for:**
- Circular gifting patterns (A gifts to B, B gifts to A repeatedly)
- Rapid coin accumulation (possible exploit)
- Bulk gift card creation
- Redemption rate anomalies

**Automatic Flags:**
- User gifts more than 55 GC in a month (system prevents)
- User receives gifts from 10+ different users in a week
- User creates 5+ gift cards in one day
- User's redemption rate is >95% (normal is ~70%)

**Response:**
- Automatic suspension of gifting privileges
- Manual review by admin
- Potential coin forfeiture for fraud

### Legal & Compliance

**Terms of Service Requirements:**
- "Gold Coins have no cash value and cannot be redeemed for currency"
- "Coins are promotional credits for platform use only"
- "Platform reserves right to modify or terminate program with 90 days notice"
- "Misuse may result in forfeiture of all coins and account suspension"
- "Coin values based on January 2026 gold prices, locked at launch"
- "Not an investment; no expectation of profit or appreciation"

**Critical:** Despite gold branding, this is a fixed-value loyalty program, NOT a commodity investment or security.

---

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
1. Auction starts when listing published
2. Timer counts down to auction_end (client-side)
3. If bid placed within last 2 minutes:
   - Extend auction_end by 2 minutes
   - Max 3 extensions per auction
4. When timer hits 0 (EVENT-DRIVEN):
   - Client calls POST /api/listings/complete
   - Server validates auction_end <= NOW (5-sec grace)
   - Server creates PaymentIntent via Stripe
   - Server creates transaction record
   - Server marks listing as 'sold'
   - Returns clientSecret for payment
5. Winner completes payment via Stripe PaymentSheet
6. Webhook (payment_intent.succeeded) notifies curator

Alternative: Curator can close early via same endpoint (reason: 'curator_closed')
Safety net: Hourly cron catches auctions expired >5 min ago
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

### Push Notifications (Implemented via `/lib/notifications.js`)
| Trigger | Recipient | Status |
|---------|-----------|--------|
| Outbid on a listing | Previous high bidder | ✅ Implemented |
| Payment received | Curator | ✅ Implemented |
| Payment failed | Buyer | ✅ Implemented |
| Item shipped (with tracking) | Buyer | ✅ Implemented |
| Dispute created | Admin | ✅ Implemented |
| Won an auction | Winner | ✅ Implemented (helper ready) |
| New listing from followed curator | Followers | ✅ Implemented |
| Delivery reminder (3 days) | Buyer | ⏳ Not yet |

### In-App Notifications (Lower Priority)
- New follower (curator)
- New message
- Listing expired (curator)
- Low health score warning (curator)

### Email (Backup - Resend)
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

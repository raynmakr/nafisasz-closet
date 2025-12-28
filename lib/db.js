import { Pool } from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result;
}

export async function initDatabase() {
  const pool = getPool();

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(20) NOT NULL,
      provider_id VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      name VARCHAR(255),
      handle VARCHAR(30) UNIQUE,
      avatar_url TEXT,
      profile_photo TEXT,
      role VARCHAR(20) DEFAULT 'buyer',
      bio TEXT,
      invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_id)
    )
  `);

  // Add columns if they don't exist (for existing databases)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS handle VARCHAR(30) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_payment_method_id VARCHAR(255);
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Curators table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS curators (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      subscription_tier VARCHAR(20) DEFAULT 'free',
      health_score INTEGER DEFAULT 100,
      total_sales INTEGER DEFAULT 0,
      total_earnings DECIMAL(10,2) DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      stripe_account_id VARCHAR(255),
      stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
      approved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Listings table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      curator_id INTEGER REFERENCES curators(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      brand VARCHAR(255),
      size VARCHAR(50),
      category VARCHAR(100),
      condition VARCHAR(50),
      retail_price DECIMAL(10,2) NOT NULL,
      starting_bid DECIMAL(10,2) NOT NULL,
      current_high_bid DECIMAL(10,2),
      high_bidder_id INTEGER REFERENCES users(id),
      photos TEXT[],
      status VARCHAR(20) DEFAULT 'draft',
      auction_duration VARCHAR(30) NOT NULL,
      auction_start TIMESTAMP,
      auction_end TIMESTAMP,
      extensions_used INTEGER DEFAULT 0,
      returns_allowed BOOLEAN DEFAULT FALSE,
      local_pickup_available BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bids table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
      bidder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      is_winning BOOLEAN DEFAULT FALSE,
      payment_intent_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add payment_intent_id column if it doesn't exist
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE bids ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Transactions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER REFERENCES listings(id) UNIQUE,
      buyer_id INTEGER REFERENCES users(id),
      curator_id INTEGER REFERENCES curators(id),
      final_price DECIMAL(10,2) NOT NULL,
      platform_fee DECIMAL(10,2) NOT NULL,
      curator_earnings DECIMAL(10,2) NOT NULL,
      shipping_cost DECIMAL(10,2),
      status VARCHAR(30) DEFAULT 'pending_payment',
      payment_intent_id VARCHAR(255),
      stripe_transfer_id VARCHAR(255),
      payout_completed_at TIMESTAMP,
      receipt_url TEXT,
      tracking_number VARCHAR(255),
      shipping_label TEXT,
      shipped_at TIMESTAMP,
      delivered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns for existing transactions tables
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_completed_at TIMESTAMP;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Follows table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      curator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, curator_id)
    )
  `);

  // Notifications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Messages table (for listing-based chat)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message_text TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, read)`);

  // Hunt Stories table (video posts from curators)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hunt_stories (
      id SERIAL PRIMARY KEY,
      curator_id INTEGER REFERENCES curators(id) ON DELETE CASCADE,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      caption TEXT,
      location VARCHAR(255),
      duration INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_stories_curator ON hunt_stories(curator_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_stories_expires ON hunt_stories(expires_at)`);

  // Story views table (track unique views)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS story_views (
      id SERIAL PRIMARY KEY,
      story_id INTEGER REFERENCES hunt_stories(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(story_id, user_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_story_views_user ON story_views(user_id)`);

  // Curator applications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS curator_applications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      instagram VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invitation codes table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(8) UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      uses_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index on invitation codes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
  `);

  // =====================================================
  // PURSE & GOLD COINS SYSTEM TABLES
  // =====================================================

  // Currency rates table - stores locked gold-based rates per currency
  await pool.query(`
    CREATE TABLE IF NOT EXISTS currency_rates (
      currency VARCHAR(3) PRIMARY KEY,
      coin_value DECIMAL(10,4) NOT NULL,
      symbol VARCHAR(10) NOT NULL,
      gold_price_at_launch DECIMAL(10,2),
      gold_basis_text TEXT,
      locked_date DATE NOT NULL,
      last_reviewed DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert locked January 2026 rates (on conflict do nothing to preserve existing)
  await pool.query(`
    INSERT INTO currency_rates (currency, coin_value, symbol, gold_price_at_launch, gold_basis_text, locked_date, last_reviewed)
    VALUES
      ('USD', 4.50, '$', 4534.00, 'Based on gold at $4,534/oz (January 2026)', '2026-01-15', '2026-01-15'),
      ('GBP', 3.50, '£', 3580.00, 'Based on gold at £3,580/oz (January 2026)', '2026-01-15', '2026-01-15'),
      ('EUR', 4.00, '€', 4280.00, 'Based on gold at €4,280/oz (January 2026)', '2026-01-15', '2026-01-15'),
      ('CAD', 6.00, 'C$', 6350.00, 'Based on gold at C$6,350/oz (January 2026)', '2026-01-15', '2026-01-15'),
      ('AED', 15.00, 'AED', 16650.00, 'Based on gold at 16,650 AED/oz (January 2026)', '2026-01-15', '2026-01-15')
    ON CONFLICT (currency) DO NOTHING
  `);

  // Add Purse columns to users table
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gold_coins INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_lifetime_earned INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
      -- Engagement reward flags (to prevent double-awarding)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_profile_complete BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_instagram_connected BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_photo_uploaded BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_notifications_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_welcome_bonus BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_birthday_year INTEGER;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Coin transactions table - logs all coin activity
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      amount INTEGER NOT NULL,
      source VARCHAR(100),
      related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      related_listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
      related_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
      balance_after INTEGER NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON coin_transactions(type, created_at DESC)`);

  // Gift cards table - tracks coin gifts between users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gift_cards (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK (amount > 0 AND amount <= 11),
      status VARCHAR(20) DEFAULT 'pending',
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      claimed_at TIMESTAMP,
      expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient ON gift_cards(recipient_id, status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_gift_cards_sender ON gift_cards(sender_id, created_at DESC)`);

  // Gifting limits table - enforces monthly gifting limits per user
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gifting_limits (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      month DATE NOT NULL,
      gifts_sent INTEGER DEFAULT 0,
      total_amount_sent INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, month),
      CONSTRAINT chk_monthly_limits CHECK (gifts_sent <= 5 AND total_amount_sent <= 55)
    )
  `);

  // Curator milestone tracking (for coin awards)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE curators ADD COLUMN IF NOT EXISTS coins_first_sale BOOLEAN DEFAULT FALSE;
      ALTER TABLE curators ADD COLUMN IF NOT EXISTS coins_10_sales BOOLEAN DEFAULT FALSE;
      ALTER TABLE curators ADD COLUMN IF NOT EXISTS coins_50_sales BOOLEAN DEFAULT FALSE;
      ALTER TABLE curators ADD COLUMN IF NOT EXISTS coins_100_followers BOOLEAN DEFAULT FALSE;
      ALTER TABLE curators ADD COLUMN IF NOT EXISTS coins_high_rating_90days BOOLEAN DEFAULT FALSE;
      ALTER TABLE curators ADD COLUMN IF NOT EXISTS high_rating_start_date DATE;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Buyer milestone tracking
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_purchases INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_first_purchase BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_third_purchase BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_fifth_purchase BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS coins_tenth_purchase BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Referral tracking - track which referrals have triggered coin awards
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id SERIAL PRIMARY KEY,
      referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      signup_bonus_awarded BOOLEAN DEFAULT FALSE,
      first_purchase_bonus_awarded BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      first_purchase_at TIMESTAMP,
      UNIQUE(referrer_id, referred_id)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_id)`);

  console.log('Database initialized');
}

// Handle and invitation code helper functions
const INVITATION_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, L, 1

export function generateHandle(name) {
  if (!name) return null;
  // Convert to lowercase, replace spaces with underscores, remove invalid chars
  let handle = name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 25);

  // Ensure it starts with a letter
  if (!/^[a-z]/.test(handle)) {
    handle = 'user_' + handle;
  }

  return handle || 'user';
}

export function generateInvitationCode() {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITATION_CODE_CHARS.charAt(Math.floor(Math.random() * INVITATION_CODE_CHARS.length));
  }
  return code;
}

export async function isHandleTaken(handle, excludeUserId = null) {
  let result;
  if (excludeUserId) {
    result = await query('SELECT id FROM users WHERE handle = $1 AND id != $2', [handle.toLowerCase(), excludeUserId]);
  } else {
    result = await query('SELECT id FROM users WHERE handle = $1', [handle.toLowerCase()]);
  }
  return result.rows.length > 0;
}

export function validateHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    return { valid: false, error: 'Handle is required' };
  }
  if (handle.length < 3) {
    return { valid: false, error: 'Handle must be at least 3 characters' };
  }
  if (handle.length > 30) {
    return { valid: false, error: 'Handle must be 30 characters or less' };
  }
  if (!/^[a-z]/.test(handle.toLowerCase())) {
    return { valid: false, error: 'Handle must start with a letter' };
  }
  if (!/^[a-z][a-z0-9_]*$/.test(handle.toLowerCase())) {
    return { valid: false, error: 'Handle can only contain letters, numbers, and underscores' };
  }
  return { valid: true };
}

export async function generateUniqueHandle(name) {
  let baseHandle = generateHandle(name);
  let handle = baseHandle;
  let attempts = 0;

  while (await isHandleTaken(handle) && attempts < 10) {
    const suffix = Math.floor(Math.random() * 1000);
    handle = `${baseHandle}_${suffix}`.substring(0, 30);
    attempts++;
  }

  return handle;
}

export async function generateUniqueInvitationCode() {
  let code = generateInvitationCode();
  let attempts = 0;

  while (attempts < 10) {
    const existing = await query('SELECT id FROM invitation_codes WHERE code = $1', [code]);
    if (existing.rows.length === 0) {
      return code;
    }
    code = generateInvitationCode();
    attempts++;
  }

  // Fallback: add timestamp
  return code + Date.now().toString(36).toUpperCase().substring(0, 4);
}

export async function validateInvitationCode(code) {
  if (!code) return null;
  const result = await query(
    `SELECT ic.*, u.id as inviter_id, u.name as inviter_name, u.handle as inviter_handle
     FROM invitation_codes ic
     JOIN users u ON ic.user_id = u.id
     WHERE ic.code = $1`,
    [code.toUpperCase()]
  );
  return result.rows[0] || null;
}

export async function createInvitationCodeForUser(userId) {
  const code = await generateUniqueInvitationCode();
  await query(
    'INSERT INTO invitation_codes (code, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
    [code, userId]
  );
  return code;
}

export async function incrementInvitationCodeUsage(code) {
  await query(
    'UPDATE invitation_codes SET uses_count = uses_count + 1 WHERE code = $1',
    [code.toUpperCase()]
  );
}

export async function getUserInvitationCode(userId) {
  const result = await query('SELECT * FROM invitation_codes WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
}

export async function getUserReferrals(userId) {
  const result = await query(
    `SELECT u.id, u.name, u.handle, u.created_at
     FROM users u
     WHERE u.invited_by_user_id = $1
     ORDER BY u.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// User functions
export async function findOrCreateUser(provider, providerId, email, name, avatarUrl, invitationCode = null) {
  const pool = getPool();

  // Check if user exists
  const existing = await pool.query(
    'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
    [provider, providerId]
  );

  if (existing.rows.length > 0) {
    // Update existing user
    const updated = await pool.query(
      `UPDATE users SET email = $1, name = $2, avatar_url = $3, updated_at = CURRENT_TIMESTAMP
       WHERE provider = $4 AND provider_id = $5 RETURNING *`,
      [email, name, avatarUrl, provider, providerId]
    );
    return updated.rows[0];
  }

  // Validate invitation code if provided
  let invitedByUserId = null;
  if (invitationCode) {
    const inviteData = await validateInvitationCode(invitationCode);
    if (inviteData) {
      invitedByUserId = inviteData.user_id;
    }
  }

  // Generate unique handle for new user
  const handle = await generateUniqueHandle(name);

  // Create new user
  const result = await pool.query(
    `INSERT INTO users (provider, provider_id, email, name, handle, avatar_url, invited_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [provider, providerId, email, name, handle, avatarUrl, invitedByUserId]
  );

  const newUser = result.rows[0];

  // Create invitation code for the new user
  await createInvitationCodeForUser(newUser.id);

  // Increment referrer's usage count if applicable
  if (invitationCode && invitedByUserId) {
    await incrementInvitationCodeUsage(invitationCode);
  }

  // Mark as new user for welcome bonus handling
  newUser._isNewUser = true;
  newUser._referrerId = invitedByUserId;

  return newUser;
}

export async function getUser(userId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

export async function updateUser(userId, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(userId);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0];
}

// Curator functions
export async function getCurator(userId) {
  const result = await query(
    `SELECT c.*, u.name, u.email, u.avatar_url
     FROM curators c JOIN users u ON c.user_id = u.id
     WHERE c.user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function getCuratorById(curatorId) {
  const result = await query(
    `SELECT c.*, u.name, u.email, u.avatar_url
     FROM curators c JOIN users u ON c.user_id = u.id
     WHERE c.id = $1`,
    [curatorId]
  );
  return result.rows[0];
}

export async function createCurator(userId) {
  const result = await query(
    `INSERT INTO curators (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  await query(`UPDATE users SET role = 'curator' WHERE id = $1`, [userId]);
  return result.rows[0];
}

export async function getApprovedCurators(limit = 20, offset = 0) {
  const result = await query(
    `SELECT c.*, u.name, u.handle, u.avatar_url, u.bio,
     (SELECT COUNT(*) FROM listings WHERE curator_id = c.id AND status = 'active') as active_listings
     FROM curators c JOIN users u ON c.user_id = u.id
     WHERE c.approved = TRUE
     ORDER BY c.total_sales DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

export async function searchCurators(searchQuery, limit = 20, offset = 0) {
  const searchPattern = `%${searchQuery}%`;
  const result = await query(
    `SELECT c.*, u.name, u.handle, u.avatar_url, u.bio,
     (SELECT COUNT(*) FROM listings WHERE curator_id = c.id AND status = 'active') as active_listings
     FROM curators c JOIN users u ON c.user_id = u.id
     WHERE c.approved = TRUE
       AND (u.handle ILIKE $1 OR u.name ILIKE $1)
     ORDER BY
       CASE WHEN u.handle ILIKE $2 THEN 0 ELSE 1 END,
       c.total_sales DESC
     LIMIT $3 OFFSET $4`,
    [searchPattern, searchQuery, limit, offset]
  );
  return result.rows;
}

// Listing functions
export async function createListing(curatorId, data) {
  const startingBid = parseFloat((data.retailPrice * 1.2).toFixed(2));

  const result = await query(
    `INSERT INTO listings (curator_id, title, description, brand, size, category, condition,
     retail_price, starting_bid, photos, auction_duration, returns_allowed, local_pickup_available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [curatorId, data.title, data.description, data.brand, data.size, data.category,
     data.condition, data.retailPrice, startingBid, data.photos, data.auctionDuration,
     data.returnsAllowed || false, data.localPickupAvailable || false]
  );
  return result.rows[0];
}

export async function updateListing(listingId, curatorId, data) {
  // Verify curator owns this listing and it's still a draft
  const existing = await query(
    `SELECT l.* FROM listings l
     JOIN curators c ON l.curator_id = c.id
     WHERE l.id = $1 AND c.id = $2`,
    [listingId, curatorId]
  );

  if (!existing.rows[0]) {
    throw new Error('Listing not found or not owned by curator');
  }

  if (existing.rows[0].status !== 'draft') {
    throw new Error('Can only edit draft listings');
  }

  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.brand !== undefined) {
    updates.push(`brand = $${paramIndex++}`);
    values.push(data.brand);
  }
  if (data.size !== undefined) {
    updates.push(`size = $${paramIndex++}`);
    values.push(data.size);
  }
  if (data.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }
  if (data.condition !== undefined) {
    updates.push(`condition = $${paramIndex++}`);
    values.push(data.condition);
  }
  if (data.retailPrice !== undefined) {
    updates.push(`retail_price = $${paramIndex++}`);
    values.push(data.retailPrice);
    // Recalculate starting bid
    const startingBid = parseFloat((data.retailPrice * 1.2).toFixed(2));
    updates.push(`starting_bid = $${paramIndex++}`);
    values.push(startingBid);
  }
  if (data.photos !== undefined) {
    updates.push(`photos = $${paramIndex++}`);
    values.push(data.photos);
  }
  if (data.auctionDuration !== undefined) {
    updates.push(`auction_duration = $${paramIndex++}`);
    values.push(data.auctionDuration);
  }
  if (data.returnsAllowed !== undefined) {
    updates.push(`returns_allowed = $${paramIndex++}`);
    values.push(data.returnsAllowed);
  }
  if (data.localPickupAvailable !== undefined) {
    updates.push(`local_pickup_available = $${paramIndex++}`);
    values.push(data.localPickupAvailable);
  }

  if (updates.length === 0) {
    return existing.rows[0];
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(listingId);

  const result = await query(
    `UPDATE listings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function getActiveListings(limit = 20, offset = 0, curatorId = null) {
  let sql = `SELECT l.*, c.id as curator_id, c.user_id as curator_user_id, u.name as curator_name, u.avatar_url as curator_avatar,
     c.rating as curator_rating, c.total_sales as curator_sales,
     (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) as bid_count
     FROM listings l
     JOIN curators c ON l.curator_id = c.id
     JOIN users u ON c.user_id = u.id
     WHERE l.status = 'active' AND l.auction_end > CURRENT_TIMESTAMP`;

  const params = [];

  if (curatorId) {
    params.push(curatorId);
    sql += ` AND c.id = $${params.length}`;
  }

  params.push(limit, offset);
  sql += ` ORDER BY l.auction_end ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getListing(listingId) {
  const result = await query(
    `SELECT l.*, c.id as curator_id, c.user_id as curator_user_id, u.name as curator_name, u.avatar_url as curator_avatar,
     c.rating as curator_rating, c.total_sales as curator_sales,
     (SELECT COUNT(*) FROM bids WHERE listing_id = l.id) as bid_count
     FROM listings l
     JOIN curators c ON l.curator_id = c.id
     JOIN users u ON c.user_id = u.id
     WHERE l.id = $1`,
    [listingId]
  );
  return result.rows[0];
}

export async function publishListing(listingId) {
  const listing = await getListing(listingId);
  if (!listing) return null;

  const durations = {
    'THIRTY_MINUTES': 30 * 60 * 1000,
    'TWO_HOURS': 2 * 60 * 60 * 1000,
    'SIX_HOURS': 6 * 60 * 60 * 1000,
    'TWENTY_FOUR_HOURS': 24 * 60 * 60 * 1000,
    'FORTY_EIGHT_HOURS': 48 * 60 * 60 * 1000
  };

  const durationMs = durations[listing.auction_duration] || durations['TWO_HOURS'];
  const auctionEnd = new Date(Date.now() + durationMs);

  const result = await query(
    `UPDATE listings SET status = 'active', auction_start = CURRENT_TIMESTAMP,
     auction_end = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [auctionEnd, listingId]
  );
  return result.rows[0];
}

// Bid functions
export async function placeBid(listingId, bidderId, amount) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get listing
    const listing = await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [listingId]);
    if (!listing.rows[0]) throw new Error('Listing not found');
    if (listing.rows[0].status !== 'active') throw new Error('Auction not active');

    const currentBid = listing.rows[0].current_high_bid || listing.rows[0].starting_bid;
    if (amount <= currentBid) throw new Error('Bid must be higher than current bid');

    // Mark previous winning bid as not winning
    await client.query('UPDATE bids SET is_winning = FALSE WHERE listing_id = $1', [listingId]);

    // Insert new bid
    const bidResult = await client.query(
      `INSERT INTO bids (listing_id, bidder_id, amount, is_winning) VALUES ($1, $2, $3, TRUE) RETURNING *`,
      [listingId, bidderId, amount]
    );

    // Update listing
    await client.query(
      `UPDATE listings SET current_high_bid = $1, high_bidder_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [amount, bidderId, listingId]
    );

    // Extend auction if within last 2 minutes and extensions available
    const now = new Date();
    const auctionEnd = new Date(listing.rows[0].auction_end);
    const timeLeft = auctionEnd - now;

    if (timeLeft < 2 * 60 * 1000 && listing.rows[0].extensions_used < 3) {
      const newEnd = new Date(auctionEnd.getTime() + 2 * 60 * 1000);
      await client.query(
        `UPDATE listings SET auction_end = $1, extensions_used = extensions_used + 1 WHERE id = $2`,
        [newEnd, listingId]
      );
    }

    await client.query('COMMIT');
    return bidResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getListingBids(listingId, limit = 10) {
  const result = await query(
    `SELECT b.*, u.name as bidder_name FROM bids b
     JOIN users u ON b.bidder_id = u.id
     WHERE b.listing_id = $1 ORDER BY b.created_at DESC LIMIT $2`,
    [listingId, limit]
  );
  return result.rows;
}

export async function getUserBids(userId) {
  const result = await query(
    `SELECT b.id, b.amount, b.is_winning, b.created_at,
     l.id as listing_id, l.title as listing_title, l.photos as listing_photos,
     l.status as listing_status, l.current_high_bid, l.auction_end
     FROM bids b
     JOIN listings l ON b.listing_id = l.id
     WHERE b.bidder_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// Follow functions
export async function followCurator(followerId, curatorUserId) {
  const result = await query(
    `INSERT INTO follows (follower_id, curator_id) VALUES ($1, $2)
     ON CONFLICT (follower_id, curator_id) DO NOTHING RETURNING *`,
    [followerId, curatorUserId]
  );
  return result.rows[0];
}

export async function unfollowCurator(followerId, curatorUserId) {
  await query(
    `DELETE FROM follows WHERE follower_id = $1 AND curator_id = $2`,
    [followerId, curatorUserId]
  );
}

export async function isFollowing(followerId, curatorUserId) {
  const result = await query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND curator_id = $2`,
    [followerId, curatorUserId]
  );
  return result.rows.length > 0;
}

export async function getFollowedCurators(userId) {
  const result = await query(
    `SELECT c.id, c.user_id, c.total_sales, c.rating, u.name, u.handle, u.avatar_url, u.bio,
     (SELECT COUNT(*) FROM listings WHERE curator_id = c.id AND status = 'active') as active_listings
     FROM follows f
     JOIN users u ON f.curator_id = u.id
     JOIN curators c ON c.user_id = u.id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getCuratorFollowers(curatorUserId) {
  const result = await query(
    `SELECT u.id, u.name, u.push_token
     FROM follows f
     JOIN users u ON f.follower_id = u.id
     WHERE f.curator_id = $1`,
    [curatorUserId]
  );
  return result.rows;
}

// =====================================================
// PURSE & GOLD COINS FUNCTIONS
// =====================================================

/**
 * Get currency rate info for a currency code
 */
export async function getCurrencyRate(currency = 'USD') {
  const result = await query(
    'SELECT * FROM currency_rates WHERE currency = $1',
    [currency]
  );
  return result.rows[0] || { currency: 'USD', coin_value: 4.50, symbol: '$' };
}

/**
 * Get all currency rates
 */
export async function getAllCurrencyRates() {
  const result = await query('SELECT * FROM currency_rates ORDER BY currency');
  return result.rows;
}

/**
 * Get user's coin balance and currency info
 */
export async function getUserPurseBalance(userId) {
  const result = await query(
    `SELECT u.gold_coins, u.coins_lifetime_earned, u.currency,
            cr.coin_value, cr.symbol, cr.gold_basis_text
     FROM users u
     LEFT JOIN currency_rates cr ON u.currency = cr.currency
     WHERE u.id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    coins: row.gold_coins || 0,
    lifetimeEarned: row.coins_lifetime_earned || 0,
    currency: row.currency || 'USD',
    coinValue: parseFloat(row.coin_value) || 4.50,
    symbol: row.symbol || '$',
    value: (row.gold_coins || 0) * (parseFloat(row.coin_value) || 4.50),
    goldBasisText: row.gold_basis_text,
  };
}

/**
 * Award coins to a user (with transaction logging)
 */
export async function awardCoins(userId, amount, source, metadata = {}) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update user balance
    const updateResult = await client.query(
      `UPDATE users
       SET gold_coins = gold_coins + $1,
           coins_lifetime_earned = coins_lifetime_earned + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING gold_coins`,
      [amount, userId]
    );

    if (!updateResult.rows[0]) {
      throw new Error('User not found');
    }

    const newBalance = updateResult.rows[0].gold_coins;

    // Log transaction
    await client.query(
      `INSERT INTO coin_transactions (user_id, type, amount, source, balance_after, metadata)
       VALUES ($1, 'earned', $2, $3, $4, $5)`,
      [userId, amount, source, newBalance, JSON.stringify(metadata)]
    );

    await client.query('COMMIT');
    return { success: true, newBalance, amount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Spend coins (with validation and transaction logging)
 */
export async function spendCoins(userId, amount, listingId, transactionId = null) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current balance
    const userResult = await client.query(
      'SELECT gold_coins, currency FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (!userResult.rows[0]) {
      throw new Error('User not found');
    }

    const currentBalance = userResult.rows[0].gold_coins || 0;

    if (amount > currentBalance) {
      throw new Error('Insufficient coin balance');
    }

    // Deduct coins
    const newBalance = currentBalance - amount;
    await client.query(
      'UPDATE users SET gold_coins = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, userId]
    );

    // Log transaction
    await client.query(
      `INSERT INTO coin_transactions (user_id, type, amount, source, related_listing_id, related_transaction_id, balance_after)
       VALUES ($1, 'spent', $2, 'checkout', $3, $4, $5)`,
      [userId, -amount, listingId, transactionId, newBalance]
    );

    await client.query('COMMIT');
    return { success: true, newBalance, coinsSpent: amount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get user's coin transaction history
 */
export async function getCoinTransactions(userId, limit = 20, offset = 0) {
  const result = await query(
    `SELECT ct.*, u.name as related_user_name, l.title as listing_title
     FROM coin_transactions ct
     LEFT JOIN users u ON ct.related_user_id = u.id
     LEFT JOIN listings l ON ct.related_listing_id = l.id
     WHERE ct.user_id = $1
     ORDER BY ct.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

/**
 * Get user's gifting limits for current month
 */
export async function getGiftingLimits(userId) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const result = await query(
    'SELECT * FROM gifting_limits WHERE user_id = $1 AND month = $2',
    [userId, monthStart.toISOString().split('T')[0]]
  );

  return result.rows[0] || { gifts_sent: 0, total_amount_sent: 0 };
}

/**
 * Create a gift card (with validation)
 */
export async function createGiftCard(senderId, recipientId, amount, message = null) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get sender balance
    const senderResult = await client.query(
      'SELECT gold_coins FROM users WHERE id = $1 FOR UPDATE',
      [senderId]
    );

    if (!senderResult.rows[0]) {
      throw new Error('Sender not found');
    }

    if (senderResult.rows[0].gold_coins < amount) {
      throw new Error('Insufficient coin balance');
    }

    // Check gifting limits
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStr = monthStart.toISOString().split('T')[0];

    // Upsert gifting limits
    const limitsResult = await client.query(
      `INSERT INTO gifting_limits (user_id, month, gifts_sent, total_amount_sent)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (user_id, month) DO UPDATE SET user_id = gifting_limits.user_id
       RETURNING *`,
      [senderId, monthStr]
    );

    const limits = limitsResult.rows[0];

    if (limits.gifts_sent >= 5) {
      throw new Error('Monthly gift limit reached (5 gifts/month)');
    }

    if (limits.total_amount_sent + amount > 55) {
      throw new Error('Monthly amount limit reached (55 GC/month)');
    }

    // Deduct coins from sender
    const newBalance = senderResult.rows[0].gold_coins - amount;
    await client.query(
      'UPDATE users SET gold_coins = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, senderId]
    );

    // Create gift card
    const giftResult = await client.query(
      `INSERT INTO gift_cards (sender_id, recipient_id, amount, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [senderId, recipientId, amount, message]
    );

    // Update gifting limits
    await client.query(
      `UPDATE gifting_limits
       SET gifts_sent = gifts_sent + 1, total_amount_sent = total_amount_sent + $1
       WHERE user_id = $2 AND month = $3`,
      [amount, senderId, monthStr]
    );

    // Log sender transaction
    await client.query(
      `INSERT INTO coin_transactions (user_id, type, amount, source, related_user_id, balance_after)
       VALUES ($1, 'gifted', $2, 'gift_sent', $3, $4)`,
      [senderId, -amount, recipientId, newBalance]
    );

    await client.query('COMMIT');
    return giftResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Claim a gift card
 */
export async function claimGiftCard(giftCardId, recipientId) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get gift card
    const giftResult = await client.query(
      `SELECT * FROM gift_cards
       WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
       FOR UPDATE`,
      [giftCardId, recipientId]
    );

    if (!giftResult.rows[0]) {
      throw new Error('Gift card not found or already claimed');
    }

    const gift = giftResult.rows[0];

    // Check expiration
    if (new Date(gift.expires_at) < new Date()) {
      await client.query(
        "UPDATE gift_cards SET status = 'expired' WHERE id = $1",
        [giftCardId]
      );
      throw new Error('Gift card has expired');
    }

    // Add coins to recipient
    const updateResult = await client.query(
      `UPDATE users
       SET gold_coins = gold_coins + $1,
           coins_lifetime_earned = coins_lifetime_earned + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING gold_coins`,
      [gift.amount, recipientId]
    );

    const newBalance = updateResult.rows[0].gold_coins;

    // Mark gift as claimed
    await client.query(
      "UPDATE gift_cards SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP WHERE id = $1",
      [giftCardId]
    );

    // Log recipient transaction
    await client.query(
      `INSERT INTO coin_transactions (user_id, type, amount, source, related_user_id, balance_after)
       VALUES ($1, 'received', $2, 'gift_received', $3, $4)`,
      [recipientId, gift.amount, gift.sender_id, newBalance]
    );

    await client.query('COMMIT');
    return { success: true, amount: gift.amount, newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get pending gift cards for a user
 */
export async function getPendingGiftCards(recipientId) {
  const result = await query(
    `SELECT gc.*, u.name as sender_name
     FROM gift_cards gc
     JOIN users u ON gc.sender_id = u.id
     WHERE gc.recipient_id = $1 AND gc.status = 'pending' AND gc.expires_at > CURRENT_TIMESTAMP
     ORDER BY gc.created_at DESC`,
    [recipientId]
  );
  return result.rows;
}

/**
 * Get referral reward tracking for a user pair
 */
export async function getReferralReward(referrerId, referredId) {
  const result = await query(
    'SELECT * FROM referral_rewards WHERE referrer_id = $1 AND referred_id = $2',
    [referrerId, referredId]
  );
  return result.rows[0];
}

/**
 * Create or update referral reward tracking
 */
export async function upsertReferralReward(referrerId, referredId, updates) {
  const result = await query(
    `INSERT INTO referral_rewards (referrer_id, referred_id, signup_bonus_awarded, first_purchase_bonus_awarded, first_purchase_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (referrer_id, referred_id)
     DO UPDATE SET
       signup_bonus_awarded = COALESCE($3, referral_rewards.signup_bonus_awarded),
       first_purchase_bonus_awarded = COALESCE($4, referral_rewards.first_purchase_bonus_awarded),
       first_purchase_at = COALESCE($5, referral_rewards.first_purchase_at)
     RETURNING *`,
    [
      referrerId,
      referredId,
      updates.signupBonusAwarded ?? null,
      updates.firstPurchaseBonusAwarded ?? null,
      updates.firstPurchaseAt ?? null,
    ]
  );
  return result.rows[0];
}

/**
 * Get follower count for a curator
 */
export async function getCuratorFollowerCount(curatorUserId) {
  const result = await query(
    'SELECT COUNT(*) as count FROM follows WHERE curator_id = $1',
    [curatorUserId]
  );
  return parseInt(result.rows[0].count, 10);
}

// =====================================================
// HUNT STORIES FUNCTIONS
// =====================================================

/**
 * Create a new hunt story
 */
export async function createStory(curatorId, data) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const result = await query(
    `INSERT INTO hunt_stories (curator_id, video_url, thumbnail_url, caption, location, duration, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [curatorId, data.videoUrl, data.thumbnailUrl || null, data.caption || null, data.location || null, data.duration || 0, expiresAt]
  );
  return result.rows[0];
}

/**
 * Get active stories (not expired) with curator info, grouped by curator
 */
export async function getActiveStories(limit = 50, userId = null) {
  const result = await query(
    `SELECT s.*,
            u.name as curator_name,
            u.handle as curator_handle,
            u.avatar_url as curator_avatar,
            u.id as curator_user_id,
            CASE WHEN sv.id IS NOT NULL THEN true ELSE false END as viewed
     FROM hunt_stories s
     JOIN curators c ON s.curator_id = c.id
     JOIN users u ON c.user_id = u.id
     LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = $2
     WHERE s.expires_at > NOW()
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit, userId]
  );
  return result.rows;
}

/**
 * Get stories by curator ID
 */
export async function getCuratorStories(curatorId, userId = null) {
  const result = await query(
    `SELECT s.*,
            CASE WHEN sv.id IS NOT NULL THEN true ELSE false END as viewed
     FROM hunt_stories s
     LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = $2
     WHERE s.curator_id = $1 AND s.expires_at > NOW()
     ORDER BY s.created_at DESC`,
    [curatorId, userId]
  );
  return result.rows;
}

/**
 * Get a single story by ID
 */
export async function getStoryById(storyId) {
  const result = await query(
    `SELECT s.*,
            u.name as curator_name,
            u.handle as curator_handle,
            u.avatar_url as curator_avatar,
            c.id as curator_id
     FROM hunt_stories s
     JOIN curators c ON s.curator_id = c.id
     JOIN users u ON c.user_id = u.id
     WHERE s.id = $1`,
    [storyId]
  );
  return result.rows[0];
}

/**
 * Record story view (upsert - only counts once per user)
 */
export async function recordStoryView(storyId, userId) {
  // Insert view record (ignore if already exists)
  await query(
    `INSERT INTO story_views (story_id, user_id) VALUES ($1, $2)
     ON CONFLICT (story_id, user_id) DO NOTHING`,
    [storyId, userId]
  );
  // Increment view count
  await query(
    'UPDATE hunt_stories SET view_count = view_count + 1 WHERE id = $1',
    [storyId]
  );
}

/**
 * Delete a story
 */
export async function deleteStory(storyId, curatorId) {
  const result = await query(
    'DELETE FROM hunt_stories WHERE id = $1 AND curator_id = $2 RETURNING *',
    [storyId, curatorId]
  );
  return result.rows[0];
}

/**
 * Delete expired stories (for cron job)
 */
export async function deleteExpiredStories() {
  const result = await query(
    'DELETE FROM hunt_stories WHERE expires_at < NOW() RETURNING id'
  );
  return result.rows.length;
}

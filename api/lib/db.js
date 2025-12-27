import { Pool } from 'pg';

let pool;

function getPool() {
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
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

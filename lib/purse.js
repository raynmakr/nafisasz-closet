/**
 * PURSE SERVICE
 * Core business logic for the Gold Coins loyalty program
 */

import { query, getPool } from './db.js';
import {
  awardCoins,
  getUserPurseBalance,
  getCurrencyRate,
  getReferralReward,
  upsertReferralReward,
  getCuratorFollowerCount,
} from './db.js';
import {
  REFERRAL_REWARDS,
  BUYER_MILESTONES,
  CURATOR_MILESTONES,
  ENGAGEMENT_REWARDS,
  SPENDING_RULES,
  GIFTING_RULES,
  BIRTHDAY_REWARD,
  getCoinValue,
} from './earning-rules.js';

// ===========================================
// WELCOME BONUS
// ===========================================

/**
 * Award welcome bonus to new user (6 GC)
 * Called once when user first signs up
 */
export async function awardWelcomeBonus(userId) {
  // Check if already awarded
  const user = await query('SELECT coins_welcome_bonus FROM users WHERE id = $1', [userId]);
  if (!user.rows[0] || user.rows[0].coins_welcome_bonus) {
    return { awarded: false, reason: 'Already awarded' };
  }

  // Award coins
  const result = await awardCoins(
    userId,
    ENGAGEMENT_REWARDS.WELCOME_BONUS.coins,
    ENGAGEMENT_REWARDS.WELCOME_BONUS.source
  );

  // Mark as awarded
  await query('UPDATE users SET coins_welcome_bonus = TRUE WHERE id = $1', [userId]);

  return { awarded: true, coins: ENGAGEMENT_REWARDS.WELCOME_BONUS.coins, ...result };
}

// ===========================================
// REFERRAL REWARDS
// ===========================================

/**
 * Award signup bonus to referred user (6 GC)
 * Called when user signs up via referral link
 */
export async function awardReferralSignupBonus(referredUserId, referrerId) {
  // Check if already tracked
  let referralReward = await getReferralReward(referrerId, referredUserId);

  if (referralReward?.signup_bonus_awarded) {
    return { awarded: false, reason: 'Already awarded' };
  }

  // Award signup bonus to the referred user
  const result = await awardCoins(
    referredUserId,
    REFERRAL_REWARDS.REFERRAL_SIGNUP_BONUS,
    'referral_signup_bonus',
    { referrerId }
  );

  // Track the reward
  await upsertReferralReward(referrerId, referredUserId, { signupBonusAwarded: true });

  return { awarded: true, coins: REFERRAL_REWARDS.REFERRAL_SIGNUP_BONUS, ...result };
}

/**
 * Award referral bonus to referrer when referred user makes first purchase (11 GC)
 * Called after a transaction is completed
 */
export async function awardReferralFirstPurchaseBonus(referredUserId) {
  // Get the user's referrer
  const user = await query('SELECT invited_by_user_id FROM users WHERE id = $1', [referredUserId]);
  if (!user.rows[0]?.invited_by_user_id) {
    return { awarded: false, reason: 'No referrer' };
  }

  const referrerId = user.rows[0].invited_by_user_id;

  // Check if already awarded
  const referralReward = await getReferralReward(referrerId, referredUserId);
  if (referralReward?.first_purchase_bonus_awarded) {
    return { awarded: false, reason: 'Already awarded' };
  }

  // Award coins to the referrer
  const result = await awardCoins(
    referrerId,
    REFERRAL_REWARDS.REFERRAL_SUCCESSFUL,
    'referral_successful',
    { referredUserId }
  );

  // Track the reward
  await upsertReferralReward(referrerId, referredUserId, {
    firstPurchaseBonusAwarded: true,
    firstPurchaseAt: new Date().toISOString(),
  });

  return { awarded: true, coins: REFERRAL_REWARDS.REFERRAL_SUCCESSFUL, referrerId, ...result };
}

// ===========================================
// BUYER MILESTONE REWARDS
// ===========================================

/**
 * Check and award buyer milestones after a purchase is completed
 * Called after transaction status changes to 'delivered'
 */
export async function checkBuyerMilestones(userId) {
  const awarded = [];

  // Get user's purchase count and milestone flags
  const user = await query(
    `SELECT completed_purchases, coins_first_purchase, coins_third_purchase,
            coins_fifth_purchase, coins_tenth_purchase
     FROM users WHERE id = $1`,
    [userId]
  );

  if (!user.rows[0]) return awarded;

  const { completed_purchases: purchases } = user.rows[0];

  // Check each milestone
  for (const [key, milestone] of Object.entries(BUYER_MILESTONES)) {
    const flagValue = user.rows[0][milestone.flag];

    // Skip if already awarded or not at threshold
    if (flagValue || purchases !== milestone.threshold) continue;

    // Award coins
    await awardCoins(userId, milestone.coins, milestone.source);

    // Mark as awarded
    await query(`UPDATE users SET ${milestone.flag} = TRUE WHERE id = $1`, [userId]);

    awarded.push({ milestone: key, coins: milestone.coins });
  }

  // Also check and award referral bonus for the referrer
  const referralResult = await awardReferralFirstPurchaseBonus(userId);
  if (referralResult.awarded) {
    awarded.push({ milestone: 'referral_reward_to_referrer', coins: referralResult.coins });
  }

  return awarded;
}

/**
 * Increment user's purchase count (call when transaction is delivered)
 */
export async function incrementPurchaseCount(userId) {
  await query(
    'UPDATE users SET completed_purchases = completed_purchases + 1 WHERE id = $1',
    [userId]
  );

  // Check for milestones
  return checkBuyerMilestones(userId);
}

// ===========================================
// CURATOR MILESTONE REWARDS
// ===========================================

/**
 * Check and award curator sale milestones
 * Called after a curator's sale is completed
 */
export async function checkCuratorSaleMilestones(curatorId) {
  const awarded = [];

  // Get curator's sale count and milestone flags
  const curator = await query(
    `SELECT c.total_sales, c.coins_first_sale, c.coins_10_sales, c.coins_50_sales, c.user_id
     FROM curators c WHERE c.id = $1`,
    [curatorId]
  );

  if (!curator.rows[0]) return awarded;

  const { total_sales: sales, user_id: userId } = curator.rows[0];

  // Check sale milestones
  const saleMilestones = [
    CURATOR_MILESTONES.FIRST_SALE,
    CURATOR_MILESTONES.TEN_SALES,
    CURATOR_MILESTONES.FIFTY_SALES,
  ];

  for (const milestone of saleMilestones) {
    const flagValue = curator.rows[0][milestone.flag];

    // Skip if already awarded or not at threshold
    if (flagValue || sales !== milestone.threshold) continue;

    // Award coins
    await awardCoins(userId, milestone.coins, milestone.source, { curatorId });

    // Mark as awarded
    await query(`UPDATE curators SET ${milestone.flag} = TRUE WHERE id = $1`, [curatorId]);

    awarded.push({ milestone: milestone.source, coins: milestone.coins });
  }

  return awarded;
}

/**
 * Check curator follower milestone (100 followers)
 */
export async function checkCuratorFollowerMilestone(curatorUserId) {
  // Get curator and follower count
  const curator = await query(
    `SELECT c.id, c.coins_100_followers FROM curators c WHERE c.user_id = $1`,
    [curatorUserId]
  );

  if (!curator.rows[0] || curator.rows[0].coins_100_followers) {
    return { awarded: false };
  }

  const followerCount = await getCuratorFollowerCount(curatorUserId);

  if (followerCount >= CURATOR_MILESTONES.HUNDRED_FOLLOWERS.threshold) {
    await awardCoins(
      curatorUserId,
      CURATOR_MILESTONES.HUNDRED_FOLLOWERS.coins,
      CURATOR_MILESTONES.HUNDRED_FOLLOWERS.source,
      { followerCount }
    );

    await query('UPDATE curators SET coins_100_followers = TRUE WHERE id = $1', [curator.rows[0].id]);

    return { awarded: true, coins: CURATOR_MILESTONES.HUNDRED_FOLLOWERS.coins };
  }

  return { awarded: false };
}

/**
 * Check curator high rating milestone (4.8+ for 90 days)
 * Should be called periodically (e.g., daily cron job)
 */
export async function checkCuratorRatingMilestone(curatorId) {
  const curator = await query(
    `SELECT c.id, c.user_id, c.rating, c.coins_high_rating_90days, c.high_rating_start_date
     FROM curators c WHERE c.id = $1`,
    [curatorId]
  );

  if (!curator.rows[0] || curator.rows[0].coins_high_rating_90days) {
    return { awarded: false };
  }

  const { rating, high_rating_start_date, user_id } = curator.rows[0];
  const minRating = CURATOR_MILESTONES.HIGH_RATING_90DAYS.minRating;

  if (rating >= minRating) {
    if (!high_rating_start_date) {
      // Start tracking
      await query('UPDATE curators SET high_rating_start_date = CURRENT_DATE WHERE id = $1', [curatorId]);
      return { awarded: false, tracking: true };
    }

    // Check if 90 days have passed
    const startDate = new Date(high_rating_start_date);
    const now = new Date();
    const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    if (daysDiff >= CURATOR_MILESTONES.HIGH_RATING_90DAYS.minDays) {
      await awardCoins(
        user_id,
        CURATOR_MILESTONES.HIGH_RATING_90DAYS.coins,
        CURATOR_MILESTONES.HIGH_RATING_90DAYS.source,
        { rating, daysMaintained: daysDiff }
      );

      await query('UPDATE curators SET coins_high_rating_90days = TRUE WHERE id = $1', [curatorId]);

      return { awarded: true, coins: CURATOR_MILESTONES.HIGH_RATING_90DAYS.coins };
    }
  } else {
    // Rating dropped below threshold, reset tracking
    if (high_rating_start_date) {
      await query('UPDATE curators SET high_rating_start_date = NULL WHERE id = $1', [curatorId]);
    }
  }

  return { awarded: false };
}

// ===========================================
// ENGAGEMENT REWARDS
// ===========================================

/**
 * Award engagement reward (one-time rewards)
 */
export async function awardEngagementReward(userId, rewardType) {
  const reward = ENGAGEMENT_REWARDS[rewardType];
  if (!reward) {
    throw new Error(`Unknown reward type: ${rewardType}`);
  }

  // Check if already awarded (for one-time rewards)
  if (reward.flag) {
    const user = await query(`SELECT ${reward.flag} FROM users WHERE id = $1`, [userId]);
    if (!user.rows[0] || user.rows[0][reward.flag]) {
      return { awarded: false, reason: 'Already awarded' };
    }
  }

  // Award coins
  const result = await awardCoins(userId, reward.coins, reward.source);

  // Mark as awarded (for one-time rewards)
  if (reward.flag) {
    await query(`UPDATE users SET ${reward.flag} = TRUE WHERE id = $1`, [userId]);
  }

  return { awarded: true, coins: reward.coins, ...result };
}

/**
 * Award review reward (can earn multiple times)
 */
export async function awardReviewReward(userId, transactionId) {
  const reward = ENGAGEMENT_REWARDS.WRITE_REVIEW;

  const result = await awardCoins(userId, reward.coins, reward.source, { transactionId });

  return { awarded: true, coins: reward.coins, ...result };
}

/**
 * Award birthday reward (once per year)
 */
export async function awardBirthdayReward(userId) {
  const currentYear = new Date().getFullYear();

  // Check if already awarded this year
  const user = await query('SELECT coins_birthday_year FROM users WHERE id = $1', [userId]);
  if (!user.rows[0] || user.rows[0].coins_birthday_year === currentYear) {
    return { awarded: false, reason: 'Already awarded this year' };
  }

  // Award coins
  const result = await awardCoins(userId, BIRTHDAY_REWARD, 'birthday_month');

  // Update year
  await query('UPDATE users SET coins_birthday_year = $1 WHERE id = $2', [currentYear, userId]);

  return { awarded: true, coins: BIRTHDAY_REWARD, ...result };
}

// ===========================================
// SPENDING VALIDATION
// ===========================================

/**
 * Validate coin spending for checkout
 * @param {number} itemPrice - Price of the item
 * @param {number} coinsToApply - Number of coins user wants to apply
 * @param {number} userBalance - User's current coin balance
 * @param {string} currency - User's currency code
 * @returns {{ valid: boolean, error?: string, discount?: number, coinsUsed?: number }}
 */
export function validateCoinSpending(itemPrice, coinsToApply, userBalance, currency = 'USD') {
  const coinValue = getCoinValue(1, currency);
  const minCoins = SPENDING_RULES.MIN_COINS;
  const maxDiscount = itemPrice * SPENDING_RULES.MAX_DISCOUNT_PERCENT;
  const maxCoins = Math.floor(maxDiscount / coinValue);

  if (coinsToApply < minCoins) {
    return { valid: false, error: `Minimum ${minCoins} coins required` };
  }

  if (coinsToApply > userBalance) {
    return { valid: false, error: 'Insufficient balance' };
  }

  if (coinsToApply > maxCoins) {
    return { valid: false, error: `Maximum ${maxCoins} coins allowed (50% of price)` };
  }

  const discount = coinsToApply * coinValue;

  return {
    valid: true,
    discount,
    coinsUsed: coinsToApply,
    finalPrice: itemPrice - discount,
  };
}

/**
 * Calculate maximum coins that can be applied for a given price
 */
export function getMaxApplicableCoins(itemPrice, userBalance, currency = 'USD') {
  const coinValue = getCoinValue(1, currency);
  const maxDiscount = itemPrice * SPENDING_RULES.MAX_DISCOUNT_PERCENT;
  const maxCoinsByPrice = Math.floor(maxDiscount / coinValue);

  return Math.min(maxCoinsByPrice, userBalance);
}

// ===========================================
// GIFTING VALIDATION
// ===========================================

/**
 * Validate gift before creating
 * @param {number} senderId - Sender's user ID
 * @param {number} recipientId - Recipient's user ID
 * @param {number} amount - Number of coins to gift
 * @returns {{ valid: boolean, error?: string }}
 */
export async function validateGift(senderId, recipientId, amount) {
  // Check amount
  if (amount < 1 || amount > GIFTING_RULES.MAX_PER_GIFT) {
    return { valid: false, error: `Gift must be 1-${GIFTING_RULES.MAX_PER_GIFT} coins` };
  }

  // Check sender balance
  const balance = await getUserPurseBalance(senderId);
  if (!balance || balance.coins < amount) {
    return { valid: false, error: 'Insufficient balance' };
  }

  // Check monthly limits
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const limits = await query(
    'SELECT * FROM gifting_limits WHERE user_id = $1 AND month = $2',
    [senderId, monthStart.toISOString().split('T')[0]]
  );

  const currentLimits = limits.rows[0] || { gifts_sent: 0, total_amount_sent: 0 };

  if (currentLimits.gifts_sent >= GIFTING_RULES.MAX_GIFTS_PER_MONTH) {
    return { valid: false, error: `Monthly gift limit reached (${GIFTING_RULES.MAX_GIFTS_PER_MONTH} gifts/month)` };
  }

  if (currentLimits.total_amount_sent + amount > GIFTING_RULES.MAX_AMOUNT_PER_MONTH) {
    return { valid: false, error: `Monthly amount limit reached (${GIFTING_RULES.MAX_AMOUNT_PER_MONTH} GC/month)` };
  }

  // Check recipient is valid
  const recipient = await query('SELECT id FROM users WHERE id = $1', [recipientId]);
  if (!recipient.rows[0]) {
    return { valid: false, error: 'Recipient not found' };
  }

  if (recipientId === senderId) {
    return { valid: false, error: 'Cannot gift to yourself' };
  }

  return { valid: true };
}

// ===========================================
// ADMIN FUNCTIONS
// ===========================================

/**
 * Manually award coins (admin only)
 */
export async function adminAwardCoins(userId, amount, reason, adminId) {
  const result = await awardCoins(userId, amount, 'admin_award', { reason, adminId });
  return result;
}

/**
 * Get platform-wide coin statistics
 */
export async function getPlatformCoinStats() {
  const result = await query(`
    SELECT
      SUM(gold_coins) as total_outstanding,
      SUM(coins_lifetime_earned) as total_issued,
      COUNT(DISTINCT user_id) as users_with_coins
    FROM users
    WHERE gold_coins > 0
  `);

  const transactionStats = await query(`
    SELECT type, SUM(ABS(amount)) as total, COUNT(*) as count
    FROM coin_transactions
    GROUP BY type
  `);

  return {
    ...result.rows[0],
    breakdownByType: transactionStats.rows,
  };
}

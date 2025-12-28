import { query, getCuratorFollowers } from './db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo Push Service
 * @param {string} pushToken - Expo push token (ExponentPushToken[xxx])
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Expo push response
 */
export async function sendPushNotification(pushToken, notification) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.log('Invalid push token:', pushToken);
    return null;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return null;
  }
}

/**
 * Send push notifications to multiple users
 * @param {string[]} pushTokens - Array of Expo push tokens
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Expo push response
 */
export async function sendBulkPushNotifications(pushTokens, notification) {
  const validTokens = pushTokens.filter(
    (token) => token && token.startsWith('ExponentPushToken')
  );

  if (validTokens.length === 0) {
    console.log('No valid push tokens');
    return null;
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('Bulk push notifications sent:', result);
    return result;
  } catch (error) {
    console.error('Failed to send bulk push notifications:', error);
    return null;
  }
}

/**
 * Get user's push token by user ID
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
export async function getUserPushToken(userId) {
  const result = await query('SELECT push_token FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.push_token || null;
}

/**
 * Get curator's user ID and push token by curator ID
 * @param {number} curatorId
 * @returns {Promise<{userId: number, pushToken: string|null}>}
 */
export async function getCuratorPushInfo(curatorId) {
  const result = await query(
    `SELECT u.id as user_id, u.push_token
     FROM curators c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1`,
    [curatorId]
  );
  return {
    userId: result.rows[0]?.user_id,
    pushToken: result.rows[0]?.push_token || null,
  };
}

/**
 * Store in-app notification in database
 * @param {number} userId
 * @param {string} type - Notification type
 * @param {string} title
 * @param {string} body
 * @param {object} data - Additional data
 */
export async function createInAppNotification(userId, type, title, body, data = {}) {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, data, created_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [userId, type, title, body, JSON.stringify(data)]
  );
}

/**
 * Send notification to user (both push and in-app)
 * @param {number} userId
 * @param {string} type - Notification type
 * @param {string} title
 * @param {string} body
 * @param {object} data - Additional data for navigation
 */
export async function notifyUser(userId, type, title, body, data = {}) {
  // Get push token
  const pushToken = await getUserPushToken(userId);

  // Send push notification if token exists
  if (pushToken) {
    await sendPushNotification(pushToken, { title, body, data });
  }

  // Store in-app notification
  await createInAppNotification(userId, type, title, body, data);
}

/**
 * Notify curator (by curator ID)
 * @param {number} curatorId
 * @param {string} type
 * @param {string} title
 * @param {string} body
 * @param {object} data
 */
export async function notifyCurator(curatorId, type, title, body, data = {}) {
  const { userId, pushToken } = await getCuratorPushInfo(curatorId);

  if (!userId) {
    console.error('Curator not found:', curatorId);
    return;
  }

  // Send push notification if token exists
  if (pushToken) {
    await sendPushNotification(pushToken, { title, body, data });
  }

  // Store in-app notification
  await createInAppNotification(userId, type, title, body, data);
}

// ============================================
// Pre-built notification helpers for common events
// ============================================

/**
 * Notify curator that payment succeeded and they should purchase the item
 */
export async function notifyCuratorPaymentReceived(curatorId, transactionId, listingTitle, buyerName, amount) {
  await notifyCurator(
    curatorId,
    'payment_received',
    'Payment Received!',
    `${buyerName} paid $${amount.toFixed(2)} for "${listingTitle}". Please purchase the item.`,
    { transactionId, screen: 'transaction-detail' }
  );
}

/**
 * Notify buyer that their payment failed
 */
export async function notifyBuyerPaymentFailed(buyerId, transactionId, listingTitle) {
  await notifyUser(
    buyerId,
    'payment_failed',
    'Payment Failed',
    `Your payment for "${listingTitle}" failed. Please try again.`,
    { transactionId, screen: 'transaction-detail' }
  );
}

/**
 * Notify admin about a dispute (stores in notifications table with admin type)
 */
export async function notifyAdminDispute(paymentIntentId, transactionId) {
  // Get admin users (you may want to configure this differently)
  const admins = await query("SELECT id FROM users WHERE role = 'admin'");

  for (const admin of admins.rows) {
    await createInAppNotification(
      admin.id,
      'dispute_created',
      'Dispute Alert',
      `A dispute was created for transaction #${transactionId}. Immediate attention required.`,
      { transactionId, paymentIntentId, screen: 'admin-disputes' }
    );
  }

  // Log for monitoring
  console.log(`DISPUTE ALERT: Transaction ${transactionId}, PaymentIntent ${paymentIntentId}`);
}

/**
 * Notify buyer they won an auction
 */
export async function notifyBuyerAuctionWon(buyerId, listingId, listingTitle, amount) {
  await notifyUser(
    buyerId,
    'auction_won',
    'You Won!',
    `Congratulations! You won "${listingTitle}" for $${amount.toFixed(2)}. Complete your payment now.`,
    { listingId, screen: 'listing-detail' }
  );
}

/**
 * Notify buyer their item has shipped
 */
export async function notifyBuyerItemShipped(buyerId, transactionId, listingTitle, trackingNumber) {
  await notifyUser(
    buyerId,
    'item_shipped',
    'Your Item Shipped!',
    `"${listingTitle}" is on its way! Tracking: ${trackingNumber || 'See details'}`,
    { transactionId, trackingNumber, screen: 'transaction-detail' }
  );
}

/**
 * Notify user they were outbid
 */
export async function notifyUserOutbid(userId, listingId, listingTitle, newHighBid) {
  await notifyUser(
    userId,
    'outbid',
    'You Were Outbid!',
    `Someone placed a higher claim on "${listingTitle}". Current: $${newHighBid.toFixed(2)}`,
    { listingId, screen: 'listing-detail' }
  );
}

/**
 * Notify user about a new message
 */
export async function notifyNewMessage(recipientId, senderName, listingId, listingTitle) {
  await notifyUser(
    recipientId,
    'new_message',
    'New Message',
    `${senderName} messaged you about "${listingTitle}"`,
    { listingId, screen: 'messages' }
  );
}

/**
 * Notify all followers when a curator posts a new listing
 */
export async function notifyFollowersNewListing(curatorUserId, curatorName, listingId, listingTitle) {
  const followers = await getCuratorFollowers(curatorUserId);

  if (followers.length === 0) {
    console.log(`No followers to notify for curator ${curatorUserId}`);
    return;
  }

  const pushTokens = followers
    .map((f) => f.push_token)
    .filter((token) => token && token.startsWith('ExponentPushToken'));

  // Send bulk push notifications
  if (pushTokens.length > 0) {
    await sendBulkPushNotifications(pushTokens, {
      title: `${curatorName} just posted!`,
      body: `New listing: "${listingTitle}"`,
      data: { listingId, screen: 'listing-detail' },
    });
  }

  // Store in-app notifications for all followers
  for (const follower of followers) {
    await createInAppNotification(
      follower.id,
      'new_listing',
      `${curatorName} just posted!`,
      `New listing: "${listingTitle}"`,
      { listingId, screen: 'listing-detail' }
    );
  }

  console.log(`Notified ${followers.length} followers about new listing ${listingId}`);
}

/**
 * Notify buyer that their order was auto-confirmed as delivered
 */
export async function notifyBuyerAutoConfirmed(buyerId, transactionId, listingTitle) {
  await notifyUser(
    buyerId,
    'auto_confirmed',
    'Order Auto-Confirmed',
    `Your order "${listingTitle}" was automatically confirmed as delivered after 7 days.`,
    { transactionId, screen: 'transaction-detail' }
  );
}

/**
 * Notify curator that their payout has been released
 */
export async function notifyCuratorPayoutReleased(curatorId, transactionId, listingTitle, amount) {
  await notifyCurator(
    curatorId,
    'payout_released',
    'Payment Released!',
    `$${amount.toFixed(2)} has been released for "${listingTitle}".`,
    { transactionId, screen: 'transaction-detail' }
  );
}

import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';
import { notifyNewMessage } from '../lib/notifications.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const decoded = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET - List conversations or messages for a listing
    if (req.method === 'GET') {
      const { listingId } = req.query;

      if (listingId) {
        // Get messages for specific listing
        return await handleGetMessages(res, decoded.userId, listingId);
      } else {
        // Get all conversations
        return await handleGetConversations(res, decoded.userId);
      }
    }

    // POST - Send a message
    if (req.method === 'POST') {
      const { listingId, text } = req.body;

      if (!listingId || !text?.trim()) {
        return res.status(400).json({ error: 'Missing listingId or text' });
      }

      return await handleSendMessage(res, decoded.userId, listingId, text.trim());
    }

    // PUT - Mark messages as read
    if (req.method === 'PUT') {
      const { action, listingId } = req.body;

      if (action === 'mark-read' && listingId) {
        return await handleMarkAsRead(res, decoded.userId, listingId);
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Messages error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get all conversations for a user
 */
async function handleGetConversations(res, userId) {
  // Get unique conversations grouped by listing
  // A conversation exists if user has sent or received messages for a listing
  const result = await query(`
    SELECT DISTINCT ON (m.listing_id)
      m.listing_id,
      l.title as listing_title,
      l.photos as listing_photos,
      l.curator_id,
      c.user_id as curator_user_id,
      cu.name as curator_name,
      (
        SELECT message_text FROM messages
        WHERE listing_id = m.listing_id
        AND (sender_id = $1 OR receiver_id = $1)
        ORDER BY created_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT created_at FROM messages
        WHERE listing_id = m.listing_id
        AND (sender_id = $1 OR receiver_id = $1)
        ORDER BY created_at DESC LIMIT 1
      ) as last_message_at,
      (
        SELECT COUNT(*)::int FROM messages
        WHERE listing_id = m.listing_id
        AND receiver_id = $1
        AND read = FALSE
      ) as unread_count,
      CASE
        WHEN c.user_id = $1 THEN (
          SELECT u2.name FROM messages m2
          JOIN users u2 ON m2.sender_id = u2.id
          WHERE m2.listing_id = m.listing_id AND m2.sender_id != $1
          ORDER BY m2.created_at DESC LIMIT 1
        )
        ELSE cu.name
      END as other_user_name
    FROM messages m
    JOIN listings l ON m.listing_id = l.id
    JOIN curators c ON l.curator_id = c.id
    JOIN users cu ON c.user_id = cu.id
    WHERE m.sender_id = $1 OR m.receiver_id = $1
    ORDER BY m.listing_id, m.created_at DESC
  `, [userId]);

  // Sort by last message time
  const conversations = result.rows.sort((a, b) =>
    new Date(b.last_message_at) - new Date(a.last_message_at)
  );

  return res.json({ conversations });
}

/**
 * Get messages for a specific listing
 */
async function handleGetMessages(res, userId, listingId) {
  // Verify user is part of this conversation (sender, receiver, or curator)
  const listingResult = await query(`
    SELECT l.*, c.user_id as curator_user_id
    FROM listings l
    JOIN curators c ON l.curator_id = c.id
    WHERE l.id = $1
  `, [listingId]);

  if (!listingResult.rows[0]) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const listing = listingResult.rows[0];

  // Get messages where user is sender or receiver
  const messagesResult = await query(`
    SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.listing_id = $1
    AND (m.sender_id = $2 OR m.receiver_id = $2)
    ORDER BY m.created_at ASC
  `, [listingId, userId]);

  // Get other participant info
  let otherUser = null;
  if (listing.curator_user_id === userId) {
    // User is curator, get the buyer info
    const buyerResult = await query(`
      SELECT DISTINCT u.id, u.name, u.handle, u.avatar_url, u.profile_photo
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.listing_id = $1 AND m.sender_id != $2
      LIMIT 1
    `, [listingId, userId]);
    const buyer = buyerResult.rows[0];
    otherUser = buyer ? {
      id: buyer.id,
      name: buyer.name,
      handle: buyer.handle,
      profilePhoto: buyer.profile_photo || buyer.avatar_url,
    } : null;
  } else {
    // User is buyer, get curator info
    const curatorResult = await query(`
      SELECT u.id, u.name, u.handle, u.avatar_url, u.profile_photo
      FROM users u
      WHERE u.id = $1
    `, [listing.curator_user_id]);
    const curator = curatorResult.rows[0];
    otherUser = curator ? {
      id: curator.id,
      name: curator.name,
      handle: curator.handle,
      profilePhoto: curator.profile_photo || curator.avatar_url,
    } : null;
  }

  return res.json({
    messages: messagesResult.rows.map(m => ({
      id: m.id,
      text: m.message_text,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
      createdAt: m.created_at,
      read: m.read,
    })),
    listing: {
      id: listing.id,
      title: listing.title,
      photo: listing.photos?.[0],
      curatorUserId: listing.curator_user_id,
    },
    otherUser,
  });
}

/**
 * Send a message
 */
async function handleSendMessage(res, senderId, listingId, text) {
  // Get listing and curator info
  const listingResult = await query(`
    SELECT l.*, c.user_id as curator_user_id, u.name as curator_name
    FROM listings l
    JOIN curators c ON l.curator_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE l.id = $1
  `, [listingId]);

  if (!listingResult.rows[0]) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const listing = listingResult.rows[0];

  // Determine receiver (if sender is curator, send to last buyer who messaged; otherwise send to curator)
  let receiverId;
  if (senderId === listing.curator_user_id) {
    // Curator is sending - find the buyer who last messaged
    const buyerResult = await query(`
      SELECT sender_id FROM messages
      WHERE listing_id = $1 AND sender_id != $2
      ORDER BY created_at DESC LIMIT 1
    `, [listingId, senderId]);

    if (!buyerResult.rows[0]) {
      return res.status(400).json({ error: 'No buyer to message yet' });
    }
    receiverId = buyerResult.rows[0].sender_id;
  } else {
    // Buyer is sending to curator
    receiverId = listing.curator_user_id;
  }

  // Insert message
  const messageResult = await query(`
    INSERT INTO messages (listing_id, sender_id, receiver_id, message_text)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [listingId, senderId, receiverId, text]);

  const message = messageResult.rows[0];

  // Get sender name for notification
  const senderResult = await query('SELECT name FROM users WHERE id = $1', [senderId]);
  const senderName = senderResult.rows[0]?.name || 'Someone';

  // Send push notification to receiver
  notifyNewMessage(receiverId, senderName, listingId, listing.title)
    .catch(err => console.error('Failed to send message notification:', err));

  return res.json({
    success: true,
    message: {
      id: message.id,
      text: message.message_text,
      senderId: message.sender_id,
      createdAt: message.created_at,
    },
  });
}

/**
 * Mark messages as read
 */
async function handleMarkAsRead(res, userId, listingId) {
  await query(`
    UPDATE messages
    SET read = TRUE
    WHERE listing_id = $1 AND receiver_id = $2 AND read = FALSE
  `, [listingId, userId]);

  return res.json({ success: true });
}

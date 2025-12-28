import jwt from 'jsonwebtoken';
import { query } from '../../lib/db.js';
import { notifyNewMessage } from '../../lib/notifications.js';

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
    // GET - List DM conversations or messages with a specific user
    if (req.method === 'GET') {
      const { userId } = req.query;

      if (userId) {
        return await handleGetDMMessages(res, decoded.userId, userId);
      } else {
        return await handleGetDMConversations(res, decoded.userId);
      }
    }

    // POST - Send a DM
    if (req.method === 'POST') {
      const { userId, text } = req.body;

      if (!userId || !text?.trim()) {
        return res.status(400).json({ error: 'Missing userId or text' });
      }

      return await handleSendDM(res, decoded.userId, userId, text.trim());
    }

    // PUT - Mark DMs as read
    if (req.method === 'PUT') {
      const { action, userId } = req.body;

      if (action === 'mark-read' && userId) {
        return await handleMarkDMAsRead(res, decoded.userId, userId);
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('DM error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get all DM conversations for a user
 */
async function handleGetDMConversations(res, userId) {
  const result = await query(`
    SELECT DISTINCT ON (other_user_id)
      other_user_id as user_id,
      u.name as user_name,
      u.handle as user_handle,
      u.avatar_url as user_avatar,
      (
        SELECT message_text FROM direct_messages
        WHERE (sender_id = $1 AND receiver_id = other_user_id)
           OR (sender_id = other_user_id AND receiver_id = $1)
        ORDER BY created_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT created_at FROM direct_messages
        WHERE (sender_id = $1 AND receiver_id = other_user_id)
           OR (sender_id = other_user_id AND receiver_id = $1)
        ORDER BY created_at DESC LIMIT 1
      ) as last_message_at,
      (
        SELECT COUNT(*)::int FROM direct_messages
        WHERE sender_id = other_user_id AND receiver_id = $1 AND read = FALSE
      ) as unread_count
    FROM (
      SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id
      FROM direct_messages
      WHERE sender_id = $1 OR receiver_id = $1
    ) as conversations
    JOIN users u ON u.id = other_user_id
    ORDER BY other_user_id, last_message_at DESC
  `, [userId]);

  // Sort by last message time
  const conversations = result.rows.sort((a, b) =>
    new Date(b.last_message_at) - new Date(a.last_message_at)
  );

  return res.json({ conversations });
}

/**
 * Get DM messages between two users
 */
async function handleGetDMMessages(res, userId, otherUserId) {
  // Get messages between the two users
  const messagesResult = await query(`
    SELECT dm.*, u.name as sender_name, u.avatar_url as sender_avatar
    FROM direct_messages dm
    JOIN users u ON dm.sender_id = u.id
    WHERE (dm.sender_id = $1 AND dm.receiver_id = $2)
       OR (dm.sender_id = $2 AND dm.receiver_id = $1)
    ORDER BY dm.created_at ASC
  `, [userId, otherUserId]);

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
  });
}

/**
 * Send a DM
 */
async function handleSendDM(res, senderId, receiverId, text) {
  // Verify receiver exists
  const receiverResult = await query('SELECT id, name FROM users WHERE id = $1', [receiverId]);
  if (!receiverResult.rows[0]) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Insert message
  const messageResult = await query(`
    INSERT INTO direct_messages (sender_id, receiver_id, message_text)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [senderId, receiverId, text]);

  const message = messageResult.rows[0];

  // Get sender name for notification
  const senderResult = await query('SELECT name FROM users WHERE id = $1', [senderId]);
  const senderName = senderResult.rows[0]?.name || 'Someone';

  // Send push notification
  notifyNewMessage(receiverId, senderName, null, 'Direct Message')
    .catch(err => console.error('Failed to send DM notification:', err));

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
 * Mark DMs as read
 */
async function handleMarkDMAsRead(res, userId, otherUserId) {
  await query(`
    UPDATE direct_messages
    SET read = TRUE
    WHERE sender_id = $1 AND receiver_id = $2 AND read = FALSE
  `, [otherUserId, userId]);

  return res.json({ success: true });
}

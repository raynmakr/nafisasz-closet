import jwt from 'jsonwebtoken';
import { getActiveStories, getCuratorStories, createStory, getStoryById, recordStoryView, deleteStory, getCurator } from '../lib/db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET stories
    if (req.method === 'GET') {
      const { curatorId, id } = req.query;
      const decoded = verifyToken(req);
      const userId = decoded?.userId || null;

      // Get single story by ID
      if (id) {
        const story = await getStoryById(id);
        if (!story) {
          return res.status(404).json({ error: 'Story not found' });
        }
        return res.json({ story: formatStory(story) });
      }

      // Get stories by curator
      if (curatorId) {
        const stories = await getCuratorStories(curatorId, userId);
        return res.json({
          stories: stories.map(formatStory)
        });
      }

      // Get all active stories, grouped by curator
      const stories = await getActiveStories(50, userId);
      const grouped = groupStoriesByCurator(stories);

      return res.json({
        curators: grouped
      });
    }

    // POST create story or record view
    if (req.method === 'POST') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { action, storyId, videoUrl, thumbnailUrl, caption, location, duration } = req.body;

      // Record view
      if (action === 'view' && storyId) {
        await recordStoryView(storyId, decoded.userId);
        return res.json({ success: true });
      }

      // Create story - curator only
      const curator = await getCurator(decoded.userId);
      if (!curator) {
        return res.status(403).json({ error: 'Only curators can post stories' });
      }

      if (!videoUrl) {
        return res.status(400).json({ error: 'Video URL is required' });
      }

      const story = await createStory(curator.id, {
        videoUrl,
        thumbnailUrl,
        caption,
        location,
        duration
      });

      return res.json({
        success: true,
        story: formatStory(story)
      });
    }

    // DELETE story
    if (req.method === 'DELETE') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const storyId = req.query.id || req.body?.id;
      if (!storyId) {
        return res.status(400).json({ error: 'Story ID is required' });
      }

      const curator = await getCurator(decoded.userId);
      if (!curator) {
        return res.status(403).json({ error: 'Only curators can delete stories' });
      }

      const deleted = await deleteStory(storyId, curator.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Story not found or not authorized' });
      }

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Stories error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function formatStory(story) {
  return {
    id: story.id,
    curatorId: story.curator_id,
    curatorName: story.curator_name,
    curatorHandle: story.curator_handle,
    curatorAvatar: story.curator_avatar,
    videoUrl: story.video_url,
    thumbnailUrl: story.thumbnail_url,
    caption: story.caption,
    location: story.location,
    duration: story.duration,
    viewCount: story.view_count,
    viewed: story.viewed || false,
    createdAt: story.created_at,
    expiresAt: story.expires_at
  };
}

function groupStoriesByCurator(stories) {
  const curatorMap = new Map();

  for (const story of stories) {
    const curatorUserId = story.curator_user_id;
    if (!curatorMap.has(curatorUserId)) {
      curatorMap.set(curatorUserId, {
        curatorId: story.curator_id,
        curatorUserId: curatorUserId,
        curatorName: story.curator_name,
        curatorHandle: story.curator_handle,
        curatorAvatar: story.curator_avatar,
        stories: [],
        hasUnwatched: false
      });
    }

    const curator = curatorMap.get(curatorUserId);
    curator.stories.push(formatStory(story));
    if (!story.viewed) {
      curator.hasUnwatched = true;
    }
  }

  // Sort curators: those with unwatched stories first, then by most recent story
  return Array.from(curatorMap.values()).sort((a, b) => {
    if (a.hasUnwatched !== b.hasUnwatched) {
      return a.hasUnwatched ? -1 : 1;
    }
    // Sort by most recent story
    const aLatest = new Date(a.stories[0]?.createdAt || 0);
    const bLatest = new Date(b.stories[0]?.createdAt || 0);
    return bLatest - aLatest;
  });
}

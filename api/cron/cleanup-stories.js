import { deleteExpiredStories } from '../../lib/db.js';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Story Cleanup Cron Job
 * Runs daily to delete expired hunt stories (older than 7 days)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  if (CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log('Cleanup stories cron: Invalid authorization');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('Cleanup stories cron started');

  try {
    const deletedCount = await deleteExpiredStories();

    console.log(`Cleanup stories cron complete: ${deletedCount} stories deleted`);

    return res.json({
      success: true,
      deleted: deletedCount,
    });
  } catch (error) {
    console.error('Cleanup stories cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}

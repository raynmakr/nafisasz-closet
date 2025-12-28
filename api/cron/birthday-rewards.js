import { query } from '../../lib/db.js';
import { awardBirthdayReward } from '../../lib/purse.js';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Birthday Rewards Cron Job
 * Runs daily to award 2 GC to users whose birthday is in the current month
 * Each user can only receive the reward once per year
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  if (CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log('Birthday rewards cron: Invalid authorization');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('Birthday rewards cron started');

  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Find users whose birthday month matches current month
    // and who haven't received the reward this year
    const result = await query(`
      SELECT id, name, birthday
      FROM users
      WHERE birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = $1
        AND (coins_birthday_year IS NULL OR coins_birthday_year < $2)
    `, [currentMonth, currentYear]);

    console.log(`Found ${result.rows.length} users with birthdays this month`);

    let awarded = 0;
    let errors = 0;

    for (const user of result.rows) {
      try {
        const awardResult = await awardBirthdayReward(user.id);
        if (awardResult.awarded) {
          console.log(`Awarded birthday bonus of ${awardResult.coins} GC to user ${user.id} (${user.name})`);
          awarded++;
        }
      } catch (err) {
        console.error(`Error awarding birthday reward to user ${user.id}:`, err);
        errors++;
      }
    }

    console.log(`Birthday rewards cron complete: ${awarded} awarded, ${errors} errors`);

    return res.json({
      success: true,
      found: result.rows.length,
      awarded,
      errors,
    });
  } catch (error) {
    console.error('Birthday rewards cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}

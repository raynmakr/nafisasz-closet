import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding Stripe columns to users table...');

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
    `);
    console.log('✓ Added stripe_customer_id');

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_payment_method_id VARCHAR(255);
    `);
    console.log('✓ Added default_payment_method_id');

    // Also add payment_intent_id to bids if missing
    await client.query(`
      ALTER TABLE bids ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);
    `);
    console.log('✓ Added payment_intent_id to bids');

    // Add stripe_transfer_id to transactions if missing
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255);
    `);
    console.log('✓ Added stripe_transfer_id to transactions');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

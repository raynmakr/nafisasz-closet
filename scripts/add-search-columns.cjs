require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Add tags column
    await client.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);
    console.log('✓ Added tags column');

    // Create GIN index for tags
    await client.query('CREATE INDEX IF NOT EXISTS idx_listings_tags ON listings USING GIN (tags)');
    console.log('✓ Created tags GIN index');

    // Create full-text search index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listings_fts ON listings
      USING GIN (to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(brand,'')))`);
    console.log('✓ Created full-text search index');

    console.log('\nMigration complete!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

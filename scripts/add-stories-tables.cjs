const { Pool } = require('pg');
// Only load dotenv if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Creating hunt_stories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hunt_stories (
        id SERIAL PRIMARY KEY,
        curator_id INTEGER REFERENCES curators(id) ON DELETE CASCADE,
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        caption TEXT,
        location VARCHAR(255),
        duration INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    console.log('Creating indexes on hunt_stories...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stories_curator ON hunt_stories(curator_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stories_expires ON hunt_stories(expires_at)`);

    console.log('Creating story_views table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS story_views (
        id SERIAL PRIMARY KEY,
        story_id INTEGER REFERENCES hunt_stories(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(story_id, user_id)
      )
    `);

    console.log('Creating index on story_views...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_story_views_user ON story_views(user_id)`);

    console.log('Migration complete!');

    // Verify tables exist
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('hunt_stories', 'story_views')
    `);
    console.log('Created tables:', result.rows.map(r => r.table_name));

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Creating feedback table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        user_handle VARCHAR(100),
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC)`);

    console.log('Feedback table created successfully!');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'feedback' ORDER BY ordinal_position
    `);
    console.log('Columns:', result.rows.map(r => r.column_name).join(', '));

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

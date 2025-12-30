const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding shipping columns to transactions table...');

    // Add Shippo-related columns to transactions
    await client.query(`
      DO $$ BEGIN
        -- Shippo integration columns
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shippo_shipment_id VARCHAR(255);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shippo_rate_id VARCHAR(255);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shippo_transaction_id VARCHAR(255);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(100);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shipping_service VARCHAR(100);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS label_url TEXT;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tracking_url TEXT;

        -- Package dimensions
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS package_weight DECIMAL(8,2);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS package_length DECIMAL(8,2);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS package_width DECIMAL(8,2);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS package_height DECIMAL(8,2);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(10) DEFAULT 'lb';
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dimension_unit VARCHAR(10) DEFAULT 'in';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    console.log('Shipping columns added successfully!');

    // Create shipping_addresses table for storing user addresses
    console.log('Creating shipping_addresses table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipping_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        street1 VARCHAR(255) NOT NULL,
        street2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        zip VARCHAR(20) NOT NULL,
        country VARCHAR(2) NOT NULL DEFAULT 'US',
        phone VARCHAR(50),
        email VARCHAR(255),
        is_default BOOLEAN DEFAULT FALSE,
        is_validated BOOLEAN DEFAULT FALSE,
        shippo_object_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user ON shipping_addresses(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shipping_addresses_default ON shipping_addresses(user_id, is_default)`);

    console.log('Shipping addresses table created!');

    // Add buyer/curator address references to transactions
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS buyer_address_id INTEGER REFERENCES shipping_addresses(id);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS curator_address_id INTEGER REFERENCES shipping_addresses(id);
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    console.log('Address references added to transactions!');

    // Verify columns
    const result = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'transactions'
      AND column_name LIKE '%ship%' OR column_name LIKE '%package%'
      ORDER BY ordinal_position
    `);
    console.log('Shipping columns:', result.rows.map(r => r.column_name).join(', '));

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Sample product data
const products = [
  { title: 'Vintage Chanel Classic Flap Bag', brand: 'Chanel', size: 'Medium', retailPrice: 8500, description: 'Stunning vintage Chanel Classic Flap in black caviar leather with gold hardware. Excellent condition, minor wear on corners.' },
  { title: 'Hermès Birkin 25 Togo Leather', brand: 'Hermès', size: '25cm', retailPrice: 12000, description: 'Rare Birkin 25 in Etoupe Togo leather with palladium hardware. Comes with box, dustbag, and receipt.' },
  { title: 'Louis Vuitton Neverfull MM', brand: 'Louis Vuitton', size: 'MM', retailPrice: 1960, description: 'Classic Neverfull in Damier Ebene canvas. Perfect everyday tote, like new condition.' },
  { title: 'Gucci Dionysus Small Shoulder Bag', brand: 'Gucci', size: 'Small', retailPrice: 2800, description: 'Beautiful Dionysus in GG Supreme canvas with suede trim. Tiger head closure, chain strap.' },
  { title: 'Prada Re-Edition 2005 Nylon Bag', brand: 'Prada', size: 'One Size', retailPrice: 1350, description: 'Trendy Re-Edition in black nylon with gold hardware. Brand new with tags.' },
  { title: 'Dior Lady Dior Medium', brand: 'Dior', size: 'Medium', retailPrice: 5500, description: 'Iconic Lady Dior in blush pink lambskin. Cannage quilting, silver charms. Pristine condition.' },
  { title: 'Bottega Veneta Cassette Bag', brand: 'Bottega Veneta', size: 'Medium', retailPrice: 3200, description: 'Signature intrecciato weave in butter yellow. Padded design, crossbody strap.' },
  { title: 'Saint Laurent Loulou Medium', brand: 'Saint Laurent', size: 'Medium', retailPrice: 2690, description: 'Quilted Y pattern in black leather. Aged gold hardware, perfect condition.' },
  { title: 'Celine Triomphe Shoulder Bag', brand: 'Celine', size: 'Medium', retailPrice: 3350, description: 'Classic Triomphe canvas with tan leather trim. Minimal wear, includes dustbag.' },
  { title: 'Fendi Baguette Sequin', brand: 'Fendi', size: 'Medium', retailPrice: 4200, description: 'Limited edition Baguette covered in iridescent sequins. Collector piece, never worn.' }
];

// Sample curator profiles
const curators = [
  { name: 'Sophie Chen', handle: 'sophiefinds', bio: 'Luxury curator based in Paris. Finding hidden gems since 2018.', location: 'Paris' },
  { name: 'Marcus Rivera', handle: 'luxurymarc', bio: 'Former Saks buyer. I know quality when I see it.', location: 'New York' },
  { name: 'Emma Thompson', handle: 'emmastyle', bio: 'Vintage specialist. Every piece tells a story.', location: 'London' },
  { name: 'Yuki Tanaka', handle: 'tokyotreasures', bio: 'Sourcing the best from Tokyo boutiques.', location: 'Tokyo' },
  { name: 'Isabella Costa', handle: 'milanfinds', bio: 'Italian fashion insider. Direct from Milan.', location: 'Milan' },
  { name: 'Alex Kim', handle: 'alexcurates', bio: 'Streetwear meets luxury. LA vibes.', location: 'Los Angeles' },
  { name: 'Charlotte Dubois', handle: 'charlottevintage', bio: 'Certified authenticator. Only the real deal.', location: 'Monaco' },
  { name: 'James Wilson', handle: 'jameswilsonstyle', bio: 'Menswear specialist expanding into accessories.', location: 'Chicago' },
  { name: 'Mia Santos', handle: 'miasantos', bio: 'Rising curator. Fresh finds daily.', location: 'Miami' },
  { name: 'Oliver Park', handle: 'oliverparkluxe', bio: 'Tech exec turned fashion hunter.', location: 'San Francisco' }
];

// Avatar URLs (placeholder images)
const avatarUrls = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop'
];

// Product images (luxury bags from Unsplash)
const productImages = [
  ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800'],
  ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800'],
  ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800'],
  ['https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800'],
  ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800'],
  ['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800', 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800'],
  ['https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800'],
  ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800'],
  ['https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800', 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800'],
  ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800']
];

// Auction durations in minutes
const durations = [30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 1440]; // 30m to 3 days

async function createTestData() {
  const client = await pool.connect();

  try {
    console.log('Creating test users and curators...\n');

    const userIds = [];
    const curatorIds = [];

    for (let i = 0; i < 10; i++) {
      const curator = curators[i];
      const email = `${curator.handle}@test.nafisascloset.com`;

      // Check if user already exists
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);

      let userId;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        console.log(`User ${curator.handle} already exists (ID: ${userId})`);
      } else {
        // Create user
        const userResult = await client.query(
          `INSERT INTO users (email, name, handle, bio, avatar_url, role, provider, provider_id)
           VALUES ($1, $2, $3, $4, $5, 'curator', 'test', $6)
           RETURNING id`,
          [email, curator.name, curator.handle, curator.bio, avatarUrls[i], `test_${curator.handle}`]
        );
        userId = userResult.rows[0].id;
        console.log(`Created user: ${curator.name} (@${curator.handle}) - ID: ${userId}`);
      }
      userIds.push(userId);

      // Check if curator record exists
      const existingCurator = await client.query('SELECT id FROM curators WHERE user_id = $1', [userId]);

      let curatorId;
      if (existingCurator.rows.length > 0) {
        curatorId = existingCurator.rows[0].id;
      } else {
        // Create curator record
        const curatorResult = await client.query(
          `INSERT INTO curators (user_id, approved, subscription_tier, stripe_account_id)
           VALUES ($1, true, 'free', NULL)
           RETURNING id`,
          [userId]
        );
        curatorId = curatorResult.rows[0].id;
        console.log(`  Created curator record - ID: ${curatorId}`);
      }
      curatorIds.push(curatorId);
    }

    console.log('\nCreating listings...\n');

    for (let i = 0; i < 10; i++) {
      const product = products[i];
      const curatorId = curatorIds[i];
      const durationMinutes = durations[i];

      const startingBid = Math.round(product.retailPrice * 1.2);
      const auctionEnd = new Date(Date.now() + durationMinutes * 60 * 1000);

      // Check if listing already exists for this curator with this title
      const existingListing = await client.query(
        'SELECT id FROM listings WHERE curator_id = $1 AND title = $2',
        [curatorId, product.title]
      );

      if (existingListing.rows.length > 0) {
        console.log(`Listing "${product.title}" already exists, skipping...`);
        continue;
      }

      // Format photos as PostgreSQL array
      const photosArray = `{${productImages[i].map(url => `"${url}"`).join(',')}}`;

      // Convert minutes to duration string for DB
      const durationStr = durationMinutes >= 1440 ? `${Math.round(durationMinutes/1440)}d` :
                          durationMinutes >= 60 ? `${Math.round(durationMinutes/60)}h` : `${durationMinutes}m`;

      const listingResult = await client.query(
        `INSERT INTO listings (
          curator_id, title, description, brand, size,
          retail_price, starting_bid, current_high_bid,
          photos, status, auction_end, auction_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, 'active', $9, $10)
        RETURNING id`,
        [
          curatorId,
          product.title,
          product.description,
          product.brand,
          product.size,
          product.retailPrice,
          startingBid,
          photosArray,
          auctionEnd,
          durationStr
        ]
      );

      const hours = Math.round(durationMinutes / 60);
      const timeStr = hours >= 24 ? `${Math.round(hours/24)}d` : `${hours}h`;
      console.log(`Created listing: "${product.title}" - $${startingBid} (${timeStr} left)`);
    }

    console.log('\nCreating sample story...\n');

    // Create a story for the first curator
    const storyExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Check if story exists
    const existingStory = await client.query(
      'SELECT id FROM hunt_stories WHERE curator_id = $1',
      [curatorIds[0]]
    );

    if (existingStory.rows.length > 0) {
      console.log('Story already exists for first curator, skipping...');
    } else {
      await client.query(
        `INSERT INTO hunt_stories (curator_id, video_url, thumbnail_url, caption, location, duration, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          curatorIds[0],
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400',
          'Just found this amazing vintage Chanel at a boutique in Le Marais! 🇫🇷✨',
          'Paris, France',
          15,
          storyExpires
        ]
      );
      console.log(`Created story for @${curators[0].handle}`);
    }

    // Create another story for variety
    const existingStory2 = await client.query(
      'SELECT id FROM hunt_stories WHERE curator_id = $1',
      [curatorIds[1]]
    );

    if (existingStory2.rows.length === 0) {
      await client.query(
        `INSERT INTO hunt_stories (curator_id, video_url, thumbnail_url, caption, location, duration, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          curatorIds[1],
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400',
          'NYC vintage shopping haul! These finds are incredible 🗽',
          'New York, NY',
          12,
          storyExpires
        ]
      );
      console.log(`Created story for @${curators[1].handle}`);
    }

    console.log('\n✅ Test data created successfully!');
    console.log('\nSummary:');
    console.log('- 10 curator accounts');
    console.log('- 10 active listings with various durations');
    console.log('- 2 sample stories');

  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTestData();

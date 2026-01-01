require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sampleListings = [
  {
    title: "Chanel Classic Flap Bag Medium",
    description: "Iconic quilted lambskin with gold hardware. Excellent condition with minor wear on corners.",
    brand: "Chanel",
    size: "Medium",
    category: "Bags",
    condition: "Excellent",
    retailPrice: 8200,
    tags: ["chanel", "flap", "bag", "quilted", "lambskin", "black", "classic", "designer"],
    photos: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Louis Vuitton Neverfull MM",
    description: "Monogram canvas tote in pristine condition. Perfect for everyday use. Includes pouch.",
    brand: "Louis Vuitton",
    size: "MM",
    category: "Bags",
    condition: "Like New",
    retailPrice: 1960,
    tags: ["louisvuitton", "lv", "neverfull", "tote", "monogram", "canvas", "brown"],
    photos: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800"],
    auctionDuration: "SIX_HOURS"
  },
  {
    title: "Hermes Birkin 30 Togo Leather",
    description: "Rare Birkin in Gold Togo leather with palladium hardware. Stamp Y. Comes with box and dustbag.",
    brand: "Hermes",
    size: "30",
    category: "Bags",
    condition: "Excellent",
    retailPrice: 15000,
    tags: ["hermes", "birkin", "togo", "leather", "gold", "luxury", "rare", "investment"],
    photos: ["https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800"],
    auctionDuration: "FORTY_EIGHT_HOURS"
  },
  {
    title: "Prada Re-Edition 2005 Nylon",
    description: "Trendy mini bag in black nylon. Worn twice, practically new with all cards.",
    brand: "Prada",
    size: "One Size",
    category: "Bags",
    condition: "Like New",
    retailPrice: 1350,
    tags: ["prada", "reedition", "nylon", "black", "mini", "shoulder", "trendy"],
    photos: ["https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800"],
    auctionDuration: "TWO_HOURS"
  },
  {
    title: "Dior Saddle Bag Oblique",
    description: "Classic saddle silhouette in navy oblique jacquard. Great vintage piece.",
    brand: "Dior",
    size: "Medium",
    category: "Bags",
    condition: "Good",
    retailPrice: 3200,
    tags: ["dior", "saddle", "oblique", "navy", "blue", "vintage", "jacquard"],
    photos: ["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Balenciaga City Bag Black",
    description: "Signature motorcycle bag in soft black lambskin. Gently used with beautiful patina.",
    brand: "Balenciaga",
    size: "Medium",
    category: "Bags",
    condition: "Good",
    retailPrice: 1890,
    tags: ["balenciaga", "city", "motorcycle", "black", "lambskin", "leather", "edgy"],
    photos: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800"],
    auctionDuration: "SIX_HOURS"
  },
  {
    title: "YSL Loulou Puffer Small",
    description: "Quilted leather shoulder bag in nude. Perfect condition, carried only a few times.",
    brand: "Saint Laurent",
    size: "Small",
    category: "Bags",
    condition: "Excellent",
    retailPrice: 2590,
    tags: ["ysl", "saintlaurent", "loulou", "puffer", "quilted", "nude", "beige", "shoulder"],
    photos: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Bottega Veneta Pouch Clutch",
    description: "Iconic oversized clutch in butter soft leather. The IT bag of the season.",
    brand: "Bottega Veneta",
    size: "Large",
    category: "Bags",
    condition: "Like New",
    retailPrice: 3200,
    tags: ["bottegaveneta", "pouch", "clutch", "leather", "green", "oversized", "trendy"],
    photos: ["https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800"],
    auctionDuration: "SIX_HOURS"
  },
  {
    title: "Fendi Baguette Sequin",
    description: "Vintage sequin baguette from the 90s. A collector's piece in purple.",
    brand: "Fendi",
    size: "One Size",
    category: "Bags",
    condition: "Vintage",
    retailPrice: 2800,
    tags: ["fendi", "baguette", "sequin", "purple", "vintage", "collector", "90s", "rare"],
    photos: ["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Burberry Trench Coat Classic",
    description: "Timeless honey-colored gabardine trench. UK size 8. Minor belt wear.",
    brand: "Burberry",
    size: "8",
    category: "Coats",
    condition: "Good",
    retailPrice: 1990,
    tags: ["burberry", "trench", "coat", "classic", "honey", "beige", "gabardine", "british"],
    photos: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Valentino Rockstud Heels Red",
    description: "Showstopping red patent pumps with signature studs. Size 38. Worn once.",
    brand: "Valentino",
    size: "38",
    category: "Shoes",
    condition: "Like New",
    retailPrice: 1095,
    tags: ["valentino", "rockstud", "heels", "pumps", "red", "patent", "studs", "sexy"],
    photos: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800"],
    auctionDuration: "SIX_HOURS"
  },
  {
    title: "Jimmy Choo Romy Pumps Nude",
    description: "Elegant pointed-toe pumps in nude patent. Size 39. Perfect for any occasion.",
    brand: "Jimmy Choo",
    size: "39",
    category: "Shoes",
    condition: "Excellent",
    retailPrice: 675,
    tags: ["jimmychoo", "romy", "pumps", "nude", "patent", "heels", "elegant", "classic"],
    photos: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800"],
    auctionDuration: "TWO_HOURS"
  },
  {
    title: "Manolo Blahnik Hangisi Blue",
    description: "The Carrie Bradshaw shoe! Royal blue satin with crystal buckle. Size 37.",
    brand: "Manolo Blahnik",
    size: "37",
    category: "Shoes",
    condition: "Like New",
    retailPrice: 1145,
    tags: ["manoloblahnik", "hangisi", "blue", "satin", "crystal", "heels", "bridal", "iconic"],
    photos: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Versace Medusa Silk Dress",
    description: "Stunning black silk mini dress with gold Medusa details. Size IT 42.",
    brand: "Versace",
    size: "42",
    category: "Dresses",
    condition: "Excellent",
    retailPrice: 2450,
    tags: ["versace", "medusa", "silk", "dress", "black", "gold", "mini", "party"],
    photos: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Reformation Midi Dress Floral",
    description: "Beautiful sustainable floral print midi dress. Size 4. Perfect for summer.",
    brand: "Reformation",
    size: "4",
    category: "Dresses",
    condition: "Like New",
    retailPrice: 298,
    tags: ["reformation", "midi", "dress", "floral", "sustainable", "summer", "romantic"],
    photos: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800"],
    auctionDuration: "TWO_HOURS"
  },
  {
    title: "Max Mara Teddy Coat Camel",
    description: "Iconic teddy bear coat in camel. Size M. The ultimate winter statement piece.",
    brand: "Max Mara",
    size: "M",
    category: "Coats",
    condition: "Excellent",
    retailPrice: 3990,
    tags: ["maxmara", "teddy", "coat", "camel", "winter", "cozy", "luxury", "statement"],
    photos: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  },
  {
    title: "Cartier Love Bracelet Gold",
    description: "18K yellow gold Love bracelet. Size 17. Includes screwdriver and box.",
    brand: "Cartier",
    size: "17",
    category: "Jewelry",
    condition: "Excellent",
    retailPrice: 7100,
    tags: ["cartier", "love", "bracelet", "gold", "18k", "jewelry", "luxury", "iconic"],
    photos: ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800"],
    auctionDuration: "FORTY_EIGHT_HOURS"
  },
  {
    title: "Rolex Datejust 36mm",
    description: "Classic Datejust in steel with silver dial. Excellent condition, serviced 2023.",
    brand: "Rolex",
    size: "36mm",
    category: "Watches",
    condition: "Excellent",
    retailPrice: 8500,
    tags: ["rolex", "datejust", "watch", "steel", "silver", "luxury", "timepiece", "classic"],
    photos: ["https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=800"],
    auctionDuration: "FORTY_EIGHT_HOURS"
  },
  {
    title: "Gucci Horsebit Loafers Black",
    description: "Classic leather loafers with gold horsebit. Size 40. Minimal sole wear.",
    brand: "Gucci",
    size: "40",
    category: "Shoes",
    condition: "Good",
    retailPrice: 890,
    tags: ["gucci", "horsebit", "loafers", "black", "leather", "classic", "preppy"],
    photos: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800"],
    auctionDuration: "SIX_HOURS"
  },
  {
    title: "Acne Studios Leather Jacket",
    description: "Buttery soft black leather moto jacket. Size 36. Scandinavian cool.",
    brand: "Acne Studios",
    size: "36",
    category: "Jackets",
    condition: "Excellent",
    retailPrice: 1850,
    tags: ["acnestudios", "leather", "jacket", "moto", "black", "scandinavian", "edgy", "cool"],
    photos: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800"],
    auctionDuration: "TWENTY_FOUR_HOURS"
  }
];

async function addSampleListings() {
  const client = await pool.connect();

  try {
    // Get the first curator (KC)
    const curatorResult = await client.query('SELECT id FROM curators WHERE approved = true LIMIT 1');
    if (curatorResult.rows.length === 0) {
      console.error('No approved curators found!');
      return;
    }
    const curatorId = curatorResult.rows[0].id;
    console.log(`Using curator ID: ${curatorId}`);

    let added = 0;
    for (const listing of sampleListings) {
      const startingBid = Math.round(listing.retailPrice * 1.20);

      // Calculate auction end based on duration
      const durationMap = {
        'THIRTY_MINUTES': 30 * 60 * 1000,
        'TWO_HOURS': 2 * 60 * 60 * 1000,
        'SIX_HOURS': 6 * 60 * 60 * 1000,
        'TWENTY_FOUR_HOURS': 24 * 60 * 60 * 1000,
        'FORTY_EIGHT_HOURS': 48 * 60 * 60 * 1000
      };

      const now = new Date();
      const auctionEnd = new Date(now.getTime() + durationMap[listing.auctionDuration]);

      await client.query(`
        INSERT INTO listings (
          curator_id, title, description, brand, size, category, condition,
          retail_price, starting_bid, photos, tags, status, auction_duration,
          auction_start, auction_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13, $14)
      `, [
        curatorId,
        listing.title,
        listing.description,
        listing.brand,
        listing.size,
        listing.category,
        listing.condition,
        listing.retailPrice,
        startingBid,
        listing.photos,
        listing.tags,
        listing.auctionDuration,
        now,
        auctionEnd
      ]);

      added++;
      console.log(`✓ Added: ${listing.title}`);
    }

    console.log(`\n✅ Successfully added ${added} sample listings!`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addSampleListings();

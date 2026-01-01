import jwt from 'jsonwebtoken';
import { searchListings, searchCurators } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

async function parseQueryWithAI(query) {
  if (!OPENAI_API_KEY) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a search query parser for a luxury fashion marketplace.
Extract structured data from natural language queries.
Return JSON with these fields (only include if explicitly mentioned or strongly implied):
- keywords: array of search terms (required)
- maxPrice: number or null
- minPrice: number or null
- brand: string or null
- category: string or null (bag, dress, shoes, jacket, etc.)
- color: string or null
- size: string or null (XS, S, M, L, XL, or numeric)

Examples:
"red leather bag under $500" -> {"keywords":["red","leather","bag"],"maxPrice":500,"color":"red","category":"bag"}
"gucci dress" -> {"keywords":["gucci","dress"],"brand":"gucci","category":"dress"}
"size medium blue jacket" -> {"keywords":["blue","jacket"],"size":"M","color":"blue","category":"jacket"}`
          },
          {
            role: 'user',
            content: query
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error('AI query parsing failed:', error);
    return null;
  }
}

function formatListing(row) {
  return {
    id: row.id.toString(),
    title: row.title,
    description: row.description,
    brand: row.brand,
    size: row.size,
    category: row.category,
    condition: row.condition,
    retailPrice: parseFloat(row.retail_price),
    startingBid: parseFloat(row.starting_bid),
    currentHighBid: row.current_high_bid ? parseFloat(row.current_high_bid) : null,
    photos: row.photos || [],
    tags: row.tags || [],
    status: row.status,
    auctionEnd: row.auction_end,
    bidCount: parseInt(row.bid_count || 0, 10),
    curator: row.curator_id ? {
      id: row.curator_id.toString(),
      userId: row.curator_user_id.toString(),
      name: row.curator_name,
      handle: row.curator_handle,
      profilePhoto: row.curator_profile_photo || row.curator_avatar,
      rating: parseFloat(row.curator_rating || 0),
      totalSales: parseInt(row.curator_sales || 0, 10),
    } : null,
  };
}

function formatCurator(row) {
  return {
    id: row.id.toString(),
    userId: row.user_id.toString(),
    name: row.name,
    handle: row.handle,
    profilePhoto: row.profile_photo || row.avatar_url,
    bio: row.bio,
    rating: parseFloat(row.rating || 0),
    totalSales: parseInt(row.total_sales || 0, 10),
    activeListings: parseInt(row.active_listings || 0, 10),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth is optional for search
    verifyToken(req);

    const {
      q: query,
      type = 'all',
      limit = '20',
      offset = '0',
      maxPrice,
      minPrice,
      ai = 'false',
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 50);
    const offsetNum = parseInt(offset, 10) || 0;

    let aiParsed = null;
    let searchFilters = {
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      minPrice: minPrice ? parseFloat(minPrice) : null,
    };

    // Use AI to parse natural language query if requested
    if (ai === 'true') {
      aiParsed = await parseQueryWithAI(query);
      if (aiParsed) {
        searchFilters = {
          ...searchFilters,
          maxPrice: aiParsed.maxPrice || searchFilters.maxPrice,
          minPrice: aiParsed.minPrice || searchFilters.minPrice,
          brand: aiParsed.brand,
          keywords: aiParsed.keywords,
        };
      }
    }

    const response = {
      query,
      aiParsed,
    };

    // Search listings
    if (type === 'all' || type === 'listings') {
      const searchQuery = aiParsed?.keywords?.join(' ') || query;
      const { results, total } = await searchListings(searchQuery, searchFilters, limitNum, offsetNum);
      response.listings = {
        results: results.map(formatListing),
        total,
      };
    }

    // Search curators
    if (type === 'all' || type === 'curators') {
      const curators = await searchCurators(query, limitNum, offsetNum);
      response.curators = {
        results: curators.map(formatCurator),
        total: curators.length,
      };
    }

    return res.json(response);

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message });
  }
}

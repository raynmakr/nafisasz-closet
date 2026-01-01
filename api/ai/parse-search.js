import jwt from 'jsonwebtoken';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query is required (min 2 characters)' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

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
            content: `You are a search query parser for a luxury fashion marketplace called Nafisa's Closet.
Extract structured data from natural language queries to help users find fashion items.

Return JSON with these fields (only include if explicitly mentioned or strongly implied):
- keywords: array of search terms (required, always include the main item being searched)
- maxPrice: number or null (extract from phrases like "under $500", "less than 300", "budget 200")
- minPrice: number or null (extract from phrases like "over $100", "at least 200")
- brand: string or null (designer/brand names like Gucci, Chanel, Louis Vuitton, Prada)
- category: string or null (bag, dress, shoes, jacket, coat, pants, skirt, top, blouse, etc.)
- color: string or null (red, blue, black, white, beige, etc.)
- size: string or null (XS, S, M, L, XL, XXL, or numeric sizes like 6, 8, 10)
- material: string or null (leather, silk, cotton, wool, cashmere, etc.)
- style: string or null (vintage, modern, casual, formal, boho, etc.)

Examples:
"red leather bag under $500" -> {"keywords":["red","leather","bag"],"maxPrice":500,"color":"red","category":"bag","material":"leather"}
"gucci dress size medium" -> {"keywords":["gucci","dress"],"brand":"Gucci","category":"dress","size":"M"}
"vintage chanel jacket" -> {"keywords":["vintage","chanel","jacket"],"brand":"Chanel","category":"jacket","style":"vintage"}
"blue silk blouse $100-300" -> {"keywords":["blue","silk","blouse"],"minPrice":100,"maxPrice":300,"color":"blue","material":"silk","category":"blouse"}`
          },
          {
            role: 'user',
            content: query.trim()
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return res.status(500).json({ error: 'Failed to parse query' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Ensure keywords is always an array
    if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      parsed.keywords = query.trim().split(/\s+/).filter(w => w.length > 1);
    }

    return res.json({
      success: true,
      data: {
        keywords: parsed.keywords,
        maxPrice: parsed.maxPrice || null,
        minPrice: parsed.minPrice || null,
        brand: parsed.brand || null,
        category: parsed.category || null,
        color: parsed.color || null,
        size: parsed.size || null,
        material: parsed.material || null,
        style: parsed.style || null,
      }
    });

  } catch (error) {
    console.error('Parse search error:', error);
    return res.status(500).json({ error: error.message });
  }
}

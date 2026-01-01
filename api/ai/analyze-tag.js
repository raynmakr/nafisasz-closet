import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAG_ASSISTANT_ID = 'asst_eTUFP4bG9dI8NfKB90fOyzcl';

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

async function openaiRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
      ...options.headers,
    },
  });
  return response.json();
}

async function waitForRun(threadId, runId) {
  let run;
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds max

  while (attempts < maxAttempts) {
    run = await openaiRequest(`/threads/${threadId}/runs/${runId}`);

    if (run.status === 'completed') {
      return run;
    } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
      throw new Error(`Run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);
    }

    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Run timed out');
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

    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Step 1: Create a thread
    const thread = await openaiRequest('/threads', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!thread.id) {
      console.error('Failed to create thread:', thread);
      return res.status(500).json({ error: 'Failed to create thread' });
    }

    // Step 2: Add message with image to thread
    const message = await openaiRequest(`/threads/${thread.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract the price and size from this clothing tag or label.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64,
              detail: 'high',
            },
          },
        ],
      }),
    });

    if (!message.id) {
      console.error('Failed to create message:', message);
      return res.status(500).json({ error: 'Failed to create message' });
    }

    // Step 3: Run the assistant
    const run = await openaiRequest(`/threads/${thread.id}/runs`, {
      method: 'POST',
      body: JSON.stringify({
        assistant_id: TAG_ASSISTANT_ID,
      }),
    });

    if (!run.id) {
      console.error('Failed to create run:', run);
      return res.status(500).json({ error: 'Failed to start analysis' });
    }

    // Step 4: Wait for completion
    await waitForRun(thread.id, run.id);

    // Step 5: Get the response
    const messages = await openaiRequest(`/threads/${thread.id}/messages`);
    const assistantMessage = messages.data?.find(m => m.role === 'assistant');

    if (!assistantMessage) {
      return res.status(500).json({ error: 'No response from assistant' });
    }

    const content = assistantMessage.content?.[0]?.text?.value;
    if (!content) {
      return res.status(500).json({ error: 'Empty response from assistant' });
    }

    // Parse JSON response
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.json({
      success: true,
      data: {
        price: parsed.price || null,
        size: parsed.size || null,
        currency: parsed.currency || 'USD',
        confidence: parsed.confidence || 'low',
      }
    });

  } catch (error) {
    console.error('Analyze tag error:', error);
    return res.status(500).json({ error: error.message });
  }
}

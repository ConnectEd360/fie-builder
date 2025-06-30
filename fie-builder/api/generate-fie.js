// api/generate-fie.js
// FERPA-compliant Vercel Edge Function for FIE generation

export default async function handler(req, res) {
  // CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentData, selectedCriteria, prompt } = req.body;

    // Validate required fields
    if (!studentData || !selectedCriteria || !prompt) {
      return res.status(400).json({ 
        error: 'Missing required fields: studentData, selectedCriteria, prompt' 
      });
    }

    // Get API key from environment variables (secure)
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('CLAUDE_API_KEY not found in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error - API key not configured' 
      });
    }

    // FERPA COMPLIANCE: Log access (no PII in logs)
    const timestamp = new Date().toISOString();
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[${timestamp}] FIE Generation Request ID: ${requestId}, Criteria Count: ${selectedCriteria.length}`);

    // Prepare Claude API request
    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        { 
          role: 'user', 
          content: prompt 
        }
      ]
    };

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Claude API Error: ${response.status} - ${errorData}`);
      return res.status(response.status).json({ 
        error: `Claude API Error: ${response.status}`,
        details: response.statusText
      });
    }

    const data = await response.json();

    // Extract text from Claude response
    let generatedText = '';
    if (data.content && Array.isArray(data.content)) {
      const textChunk = data.content.find(c => c.type === 'text');
      if (textChunk && textChunk.text) {
        generatedText = textChunk.text;
      } else {
        throw new Error('Claude responded but did not return text content.');
      }
    } else {
      throw new Error('Invalid response format from Claude API.');
    }

    // FERPA COMPLIANCE: Log successful generation (no PII)
    console.log(`[${timestamp}] FIE Generated Successfully - Request ID: ${requestId}, Length: ${generatedText.length} chars`);

    // Return the generated report
    return res.status(200).json({
      success: true,
      report: generatedText,
      requestId: requestId,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('Error generating FIE report:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

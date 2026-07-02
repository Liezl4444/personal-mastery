// reflect.js — GIBS Personal Mastery Campaign Experience
// Uses Node's built-in https module (no fetch, works on Node 14/16/18+)

const https = require('https');

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function (event) {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { prompt1, prompt2, prompt3 } = body;

  if (!prompt1 || !prompt2 || !prompt3) {
    return { statusCode: 400, body: JSON.stringify({ error: 'All three reflection prompts are required.' }) };
  }

  const MAX_CHARS = 1500;
  if (prompt1.length > MAX_CHARS || prompt2.length > MAX_CHARS || prompt3.length > MAX_CHARS) {
    return { statusCode: 400, body: JSON.stringify({ error: 'One or more responses exceed the maximum length.' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Service configuration error. Please try again later.' }) };
  }

  const userMessage = `Here is what someone wrote to themselves, in three parts.

PART 1 - What it has taken to get here:
${prompt1}

PART 2 - The person they are becoming:
${prompt2}

PART 3 - The gap between who they are and who they could be:
${prompt3}`;

  const systemPrompt = `You are this person — the version of them who has already done the work of personal mastery. You have just read what they wrote to you. Now speak back to them, in first person, as yourself.

You are not a coach. You are not an AI. You are the person they are becoming — and you share their history.

Rules:
- Use "I" and "we" — you share the same story, the same memories, the same body.
- Acknowledge one specific thing they said, but do not summarise or repeat it back. Speak to what it reveals.
- Do not give advice. Do not offer solutions. Do not tell them what to do.
- Speak from the future back to the present — with warmth, not sentimentality.
- End with one sentence that opens a door. Not a question that demands an answer right now. One that stays with them.
- Three to four sentences maximum. No more.
- Use South African English spelling (recognise, practise, organisation, behaviour).
- Tone: warm, unhurried, honest. The way you would speak to yourself if you finally stopped being afraid to.`;

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  try {
    const result = await httpsPost(
      'https://api.anthropic.com/v1/messages',
      {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      requestBody
    );

    console.log('Anthropic response status:', result.status);

    if (result.status !== 200) {
      console.error('Anthropic API error:', result.status, result.body);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not reach the reflection service. Please try again.' }) };
    }

    let data;
    try {
      data = JSON.parse(result.body);
    } catch (e) {
      console.error('Failed to parse Anthropic response:', result.body);
      return { statusCode: 502, body: JSON.stringify({ error: 'Invalid response from reflection service.' }) };
    }

    const reflection = data?.content?.[0]?.text;
    if (!reflection) {
      console.error('No text in response:', JSON.stringify(data));
      return { statusCode: 502, body: JSON.stringify({ error: 'No response received. Please try again.' }) };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ response: reflection })
    };

  } catch (err) {
    console.error('Function error:', err.message, err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }) };
  }
};

const PRIMARY_MODEL = process.env.OPENROUTER_PRIMARY_MODEL || 'google/gemma-4-26b-a4b-it:free';
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-oss-20b:free';

async function createAnswerStream(systemPrompt, userPrompt) {
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    'X-Title': 'Quill',
  };
  const request = model => fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, stream: true, temperature: 0.2, max_tokens: 1200, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
  });
  let response = await request(PRIMARY_MODEL);
  if (response.ok) return { response, modelUsed: PRIMARY_MODEL };
  response = await request(FALLBACK_MODEL);
  return { response, modelUsed: FALLBACK_MODEL };
}

module.exports = { createAnswerStream };

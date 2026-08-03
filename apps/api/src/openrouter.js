const PRIMARY_MODEL = process.env.OPENROUTER_PRIMARY_MODEL || 'openai/gpt-oss-20b:free';
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'google/gemma-4-26b-a4b-it:free';

async function createArticleCompletion(systemPrompt, userPrompt, model) {
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    'X-Title': 'Quill',
  };
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, stream: false, temperature: 0.2, max_tokens: 1800, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
  });
  if (!response.ok) throw new Error(`The answer model returned ${response.status}.`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('The answer model returned no article content.');
  return { content, modelUsed: model };
}

module.exports = { FALLBACK_MODEL, PRIMARY_MODEL, createArticleCompletion };

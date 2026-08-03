const cors = require('cors');
const express = require('express');
require('dotenv').config();

const cache = require('./cache');
const { optionalUser } = require('./auth');
const { extractDomain, extractPage, isSafePublicUrl, rankQuotes, searchSearxng } = require('./source');
const { queryDuckDuckGoMcp, extractWithPlaywright } = require('./fallbacks');
const { createAnswerStream } = require('./openrouter');
const { readCache, saveSearch } = require('./persistence');
const { consume } = require('./rate-limit');

const app = express();
const port = Number(process.env.PORT || 10000);
const cacheTtlMs = Number(process.env.SEARCH_CACHE_TTL_MS || 21600000);
const rateLimit = Number(process.env.SEARCH_RATE_LIMIT || 12);
const rateWindowMs = Number(process.env.SEARCH_RATE_WINDOW_MS || 3600000);
const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '12kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'quill-api', searxngConfigured: Boolean(process.env.SEARXNG_URL), duckDuckGoFallbackConfigured: Boolean(process.env.DDG_MCP_SEARCH_URL), playwrightFallbackConfigured: Boolean(process.env.PLAYWRIGHT_EXTRACTOR_URL) });
});

function sourceCards(results, quotes) {
  return results.map(result => ({
    title: result.title,
    url: result.url,
    domain: extractDomain(result.url),
    snippet: result.snippet || '',
    quoteCount: quotes.filter(quote => quote.sourceUrl === result.url).length,
  }));
}

async function gatherEvidence(query) {
  let results = [];
  try {
    results = await searchSearxng(query, process.env.SEARXNG_URL);
  } catch (error) {
    console.warn('SearXNG search failed:', error.message);
  }
  if (results.length < 3) {
    const fallback = await queryDuckDuckGoMcp(query);
    const known = new Set(results.map(result => result.url));
    results = [...results, ...fallback.filter(result => result.url && isSafePublicUrl(result.url) && !known.has(result.url))].slice(0, 8);
  }
  if (results.length === 0) throw new Error('No source results were available.');

  const pages = await Promise.all(results.slice(0, 5).map(async result => {
    const staticPage = await extractPage(result.url, result.title);
    if (staticPage?.paragraphs.length) return staticPage;
    const rendered = await extractWithPlaywright(result.url);
    if (!rendered?.text) return staticPage;
    return { url: result.url, title: rendered.title || result.title, domain: extractDomain(result.url), paragraphs: String(rendered.text).split(/\n{2,}/).map(text => text.trim()).filter(text => text.length >= 50 && text.length <= 900).slice(0, 20) };
  }));
  const quotes = rankQuotes(query, pages);
  if (!quotes.length) throw new Error('The sources did not contain enough readable evidence to quote.');
  return { sources: sourceCards(results, quotes), quotes };
}

function prompts(query, quotes) {
  const evidence = quotes.map(quote => `[${quote.id}] ${quote.authorOrPublisher} | ${quote.sourceUrl}\n${quote.verbatimQuote}`).join('\n\n');
  return {
    system: 'You are Quill, an evidence-first search writer. Write a concise, readable newsletter-style answer using only the evidence excerpts supplied. Never invent quotes, attributions, dates, figures, or sources. If evidence is weak or conflicting, say so. Use Markdown headings beginning with ###. For each key section, insert one exact quote token such as [[quote:Q1]]. Do not type quotation marks or attribution lines: Quill renders the stored excerpt. Use at most three tokens and only IDs supplied.',
    user: `Question: ${query}\n\nEvidence excerpts:\n${evidence}\n\nWrite the answer.`,
  };
}

function writeMetadata(response, metadata) {
  response.write(`${JSON.stringify({ type: 'metadata', ...metadata })}\n---META---\n`);
}

async function streamProvider(response, providerResponse) {
  const reader = providerResponse.body.getReader();
  const decoder = new TextDecoder();
  let answer = '';
  let remainder = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = (remainder + decoder.decode(value, { stream: true })).split('\n');
    remainder = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = line.slice(6).trim();
      if (!event || event === '[DONE]') continue;
      try {
        const text = (JSON.parse(event).choices?.[0]?.delta?.content || '').replace(/[“”"]/g, '');
        if (text) {
          answer += text;
          response.write(text);
        }
      } catch {}
    }
  }
  return answer;
}

app.post('/api/search', async (request, response) => {
  const query = typeof request.body?.query === 'string' ? request.body.query.trim() : '';
  if (query.length < 3 || query.length > 500) return response.status(400).json({ error: 'Enter a search question between 3 and 500 characters.' });
  if (!process.env.OPENROUTER_API_KEY) return response.status(503).json({ error: 'The Quill server is missing its OpenRouter configuration.' });

  const rate = consume(request.ip, rateLimit, rateWindowMs);
  if (!rate.allowed) {
    response.setHeader('Retry-After', String(Math.ceil(rate.retryAfterMs / 1000)));
    return response.status(429).json({ error: 'Search limit reached. Please try again later.' });
  }
  response.setHeader('X-RateLimit-Remaining', String(rate.remaining));

  const cacheKey = cache.normalizeQuery(query);
  const memoryHit = cache.get(cacheKey);
  const persistentHit = memoryHit || await readCache(cacheKey);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();

  if (persistentHit) {
    writeMetadata(response, { sources: persistentHit.sources, quotes: persistentHit.quotes, cached: true, modelUsed: persistentHit.modelUsed });
    response.write(persistentHit.answerMarkdown);
    return response.end();
  }

  try {
    const user = await optionalUser(request);
    const { sources, quotes } = await gatherEvidence(query);
    writeMetadata(response, { sources, quotes, cached: false });
    const { system, user: prompt } = prompts(query, quotes);
    const { response: providerResponse, modelUsed } = await createAnswerStream(system, prompt);
    if (!providerResponse.ok || !providerResponse.body) throw new Error('The answer model is temporarily unavailable.');
    const answerMarkdown = await streamProvider(response, providerResponse);
    const record = { cacheKey, query, answerMarkdown, sources, quotes, modelUsed, expiresAt: Date.now() + cacheTtlMs, userId: user?.uid };
    cache.set(cacheKey, record, cacheTtlMs);
    void saveSearch(record);
  } catch (error) {
    response.write(`### Evidence unavailable\n\nQuill could not assemble enough readable evidence for this question. ${error.message}`);
  }
  response.end();
});

app.listen(port, () => console.log(`Quill API listening on ${port}`));

const cors = require('cors');
const express = require('express');
require('dotenv').config();

const { fallbackArticle, validateArticle } = require('./article');
const cache = require('./cache');
const { optionalUser } = require('./auth');
const { extractDomain, extractPage, fallbackFavicon, isSafePublicUrl, rankQuotes, searchSearxng } = require('./source');
const { queryDuckDuckGoMcp, extractWithPlaywright } = require('./fallbacks');
const { FALLBACK_MODEL, PRIMARY_MODEL, createArticleCompletion } = require('./openrouter');
const { readCache, saveSearch } = require('./persistence');
const { consume } = require('./rate-limit');

const app = express();
const port = Number(process.env.PORT || 10000);
const cacheTtlMs = Number(process.env.SEARCH_CACHE_TTL_MS || 21600000);
const rateLimit = Number(process.env.SEARCH_RATE_LIMIT || 12);
const rateWindowMs = Number(process.env.SEARCH_RATE_WINDOW_MS || 3600000);
const allowedOrigins = process.env.ALLOWED_ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean);
const articleCacheVersion = 'article-v2';

app.set('trust proxy', 1);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '12kb' }));

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'quill-api',
    articleContract: articleCacheVersion,
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    searxngConfigured: Boolean(process.env.SEARXNG_URL),
    duckDuckGoFallbackConfigured: Boolean(process.env.DDG_MCP_SEARCH_URL),
    playwrightFallbackConfigured: Boolean(process.env.PLAYWRIGHT_EXTRACTOR_URL),
  });
});

function sourceCards(pages, quotes) {
  const quoteUrls = new Set(quotes.map(quote => quote.sourceUrl));
  return pages.filter(page => page && quoteUrls.has(page.url)).map((page, index) => ({
    id: `S${index + 1}`,
    title: page.title,
    url: page.url,
    domain: page.domain,
    publisher: page.publisher || page.domain,
    faviconUrl: page.faviconUrl || fallbackFavicon(page.url),
    snippet: '',
    quoteCount: quotes.filter(quote => quote.sourceUrl === page.url).length,
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
    return {
      url: result.url,
      title: rendered.title || staticPage?.title || result.title,
      domain: extractDomain(result.url),
      publisher: staticPage?.publisher || extractDomain(result.url),
      faviconUrl: staticPage?.faviconUrl || fallbackFavicon(result.url),
      paragraphs: String(rendered.text).split(/\n{2,}/).map(text => text.trim()).filter(text => text.length >= 50 && text.length <= 900).slice(0, 20),
    };
  }));
  const rankedQuotes = rankQuotes(query, pages);
  if (!rankedQuotes.length) throw new Error('The sources did not contain enough readable evidence to quote.');
  const sources = sourceCards(pages, rankedQuotes);
  const sourceIdByUrl = new Map(sources.map(source => [source.url, source.id]));
  const quotes = rankedQuotes.filter(quote => sourceIdByUrl.has(quote.sourceUrl)).map(quote => ({ ...quote, sourceId: sourceIdByUrl.get(quote.sourceUrl) }));
  if (!sources.length || !quotes.length) throw new Error('The available sources did not contain enough attributable evidence.');
  return { sources, quotes };
}

function prompts(query, sources, quotes) {
  const sourceList = sources.map(source => `[${source.id}] ${source.publisher} | ${source.title} | ${source.url}`).join('\n');
  const evidence = quotes.map(quote => `[${quote.id}] source=${quote.sourceId} | ${quote.authorOrPublisher}\n${quote.verbatimQuote}`).join('\n\n');
  return {
    system: `You are Quill, an evidence-first search writer. Use only the supplied sources and excerpts. Write in a concise newsletter voice: direct, clear, and human. Never invent details, dates, claims, or quotations. Do not turn weak evidence into certainty. Return valid JSON only, without Markdown or code fences, matching exactly this shape: {"intro":"...","sections":[{"heading":"...","paragraphs":[{"text":"...","sourceIds":["S1"]}],"quoteIds":["Q1"]}]}. The intro needs a direct answer. Use 2 to 4 meaningful sections. Each paragraph must be supported by one to three source IDs. Use one or two exact quote IDs in relevant sections. Quote IDs only point to excerpts already supplied; never reproduce or alter them in paragraph text.`,
    user: `Question: ${query}\n\nSources:\n${sourceList}\n\nExact evidence excerpts:\n${evidence}\n\nWrite the JSON article.`,
  };
}

async function generateArticle(query, sources, quotes) {
  const { system, user } = prompts(query, sources, quotes);
  const errors = [];
  for (const model of [...new Set([PRIMARY_MODEL, FALLBACK_MODEL])]) {
    try {
      const { content, modelUsed } = await createArticleCompletion(system, user, model);
      return { article: validateArticle(content, sources, quotes), modelUsed };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
    }
  }
  console.warn('Article generation fell back to source excerpts:', errors.join(' | '));
  return { article: fallbackArticle(quotes), modelUsed: 'evidence-only-fallback' };
}

function parseCachedArticle(record) {
  try {
    return JSON.parse(record.answerMarkdown);
  } catch {
    return null;
  }
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

  const cacheKey = `${articleCacheVersion}:${cache.normalizeQuery(query)}`;
  const memoryHit = cache.get(cacheKey);
  const persistentHit = memoryHit || await readCache(cacheKey);
  if (persistentHit) {
    const article = parseCachedArticle(persistentHit);
    if (article) return response.json({ sources: persistentHit.sources, quotes: persistentHit.quotes, article, cached: true, modelUsed: persistentHit.modelUsed });
  }

  try {
    const [user, evidence] = await Promise.all([optionalUser(request), gatherEvidence(query)]);
    const { sources, quotes } = evidence;
    const { article, modelUsed } = await generateArticle(query, sources, quotes);
    const record = { cacheKey, query, answerMarkdown: JSON.stringify(article), sources, quotes, modelUsed, expiresAt: Date.now() + cacheTtlMs, userId: user?.uid };
    cache.set(cacheKey, record, cacheTtlMs);
    void saveSearch(record);
    return response.json({ sources, quotes, article, cached: false, modelUsed });
  } catch (error) {
    return response.status(422).json({ error: `Quill could not assemble enough readable evidence for this question. ${error.message}` });
  }
});

app.listen(port, () => console.log(`Quill API listening on ${port}`));

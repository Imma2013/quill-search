import { NextRequest } from 'next/server';
import { fallbackArticle, validateArticle } from '@/lib/backend/article';
import cache from '@/lib/backend/cache';
import { optionalUser } from '@/lib/backend/auth';
import { fallbackFavicon, rankQuotes, searchTavily } from '@/lib/backend/source';
import { FALLBACK_MODEL, PRIMARY_MODEL, createArticleCompletion } from '@/lib/backend/openrouter';
import { readCache, saveSearch } from '@/lib/backend/persistence';
import { consume } from '@/lib/backend/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60; // Set Vercel execution time limit to 60 seconds (Hobby Max)

const cacheTtlMs = Number(process.env.SEARCH_CACHE_TTL_MS || 21600000);
const rateLimit = Number(process.env.SEARCH_RATE_LIMIT || 12);
const rateWindowMs = Number(process.env.SEARCH_RATE_WINDOW_MS || 3600000);
const articleCacheVersion = 'article-v3';

function sourceCards(pages: any[], quotes: any[]) {
  const quoteUrls = new Set(quotes.map(quote => quote.sourceUrl));
  return pages.filter(page => page && quoteUrls.has(page.url)).map((page: any, index: number) => ({
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

async function gatherEvidence(query: string) {
  const pages = await searchTavily(query);
  if (pages.length === 0) throw new Error('No source results were available.');

  const rankedQuotes = rankQuotes(query, pages);
  if (!rankedQuotes.length) throw new Error('The sources did not contain enough readable evidence to quote.');
  
  const sources = sourceCards(pages, rankedQuotes);
  const sourceIdByUrl = new Map(sources.map(source => [source.url, source.id]));
  const quotes = rankedQuotes.filter(quote => sourceIdByUrl.has(quote.sourceUrl)).map(quote => ({ ...quote, sourceId: sourceIdByUrl.get(quote.sourceUrl) }));
  
  if (!sources.length || !quotes.length) throw new Error('The available sources did not contain enough attributable evidence.');
  return { sources, quotes };
}

function prompts(query: string, sources: any[], quotes: any[]) {
  const sourceList = sources.map(source => `[${source.id}] ${source.publisher} | ${source.title} | ${source.url}`).join('\n');
  const evidence = quotes.map(quote => `[${quote.id}] source=${quote.sourceId} | ${quote.authorOrPublisher}\n${quote.verbatimQuote}`).join('\n\n');
  return {
    system: `You are Quill, an elite evidence-first search journalist. Write in a flowing, narrative style like a feature article in a premium magazine.
CRITICAL INSTRUCTIONS:
1. DO NOT use bullet points, numbered lists, or standard AI-like formatting. Write in cohesive paragraphs.
2. Seamlessly weave short quotes into your sentences (e.g. Steve Jobs protected his focus, famously stating that "innovation came from saying no.")
3. Only use quoteIds (blockquotes) for exceptionally powerful, standalone statements.
4. Never invent details, dates, claims, or quotations.

Return valid JSON only, without Markdown or code fences, matching exactly this shape: {"intro":"...","sections":[{"heading":"...","paragraphs":[{"text":"...","sourceIds":["S1"]}],"quoteIds":["Q1"]}]}. 
The intro needs a direct answer. Use 2 to 4 meaningful sections. Each paragraph must be supported by one to three source IDs. Quote IDs only point to excerpts already supplied.`,
    user: `Question: ${query}\n\nSources:\n${sourceList}\n\nExact evidence excerpts:\n${evidence}\n\nWrite the JSON article.`,
  };
}

async function generateArticle(query: string, sources: any[], quotes: any[]) {
  const { system, user } = prompts(query, sources, quotes);
  const errors = [];
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL].filter((v, i, a) => a.indexOf(v) === i)) {
    try {
      const { content, modelUsed } = await createArticleCompletion(system, user, model);
      return { article: validateArticle(content, sources, quotes), modelUsed };
    } catch (error: any) {
      errors.push(`${model}: ${error.message}`);
    }
  }
  console.warn('Article generation fell back to source excerpts:', errors.join(' | '));
  return { article: fallbackArticle(quotes), modelUsed: 'evidence-only-fallback' };
}

function parseCachedArticle(record: any) {
  try {
    return JSON.parse(record.answerMarkdown);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (query.length < 3 || query.length > 500) {
    return Response.json({ error: 'Enter a search question between 3 and 500 characters.' }, { status: 400 });
  }
  
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: 'The Quill server is missing its OpenRouter configuration.' }, { status: 503 });
  }

  // NextRequest does not have an easy .ip property that works correctly in all environments
  // In Vercel, x-forwarded-for contains the IP.
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rate = consume(ip, rateLimit, rateWindowMs);
  if (!rate.allowed) {
    return Response.json({ error: 'Search limit reached. Please try again later.' }, { 
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
        'X-RateLimit-Remaining': String(rate.remaining)
      }
    });
  }

  const cacheKey = `${articleCacheVersion}:${cache.normalizeQuery(query)}`;
  const memoryHit = cache.get(cacheKey);
  const persistentHit = memoryHit || await readCache(cacheKey);
  if (persistentHit) {
    const article = parseCachedArticle(persistentHit);
    if (article) {
      return Response.json({ 
        sources: persistentHit.sources, 
        quotes: persistentHit.quotes, 
        article, 
        cached: true, 
        modelUsed: persistentHit.modelUsed 
      }, {
        headers: { 'X-RateLimit-Remaining': String(rate.remaining) }
      });
    }
  }

  try {
    // We mock the express request object for optionalUser since it uses .get('authorization')
    const authReq = { get: (headerName: string) => request.headers.get(headerName) };
    const [user, evidence] = await Promise.all([optionalUser(authReq), gatherEvidence(query)]);
    const { sources, quotes } = evidence;
    const { article, modelUsed } = await generateArticle(query, sources, quotes);
    
    const record = { cacheKey, query, answerMarkdown: JSON.stringify(article), sources, quotes, modelUsed, expiresAt: Date.now() + cacheTtlMs, userId: user?.uid };
    cache.set(cacheKey, record, cacheTtlMs);
    void saveSearch(record);
    
    return Response.json({ sources, quotes, article, cached: false, modelUsed }, {
      headers: { 'X-RateLimit-Remaining': String(rate.remaining) }
    });
  } catch (error: any) {
    return Response.json({ error: `Quill could not assemble enough readable evidence for this question. ${error.message}` }, { status: 422 });
  }
}

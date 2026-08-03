const cheerio = require('cheerio');

function extractDomain(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

function isSafePublicUrl(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (host === 'localhost' || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|0\.0\.0\.0|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function searchSearxng(query, baseUrl) {
  if (!baseUrl) throw new Error('SEARXNG_URL is not configured.');
  const url = new URL('/search', baseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', 'general');
  url.searchParams.set('language', 'en');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`SearXNG returned ${response.status}.`);
    const payload = await response.json();
    return Array.isArray(payload.results)
      ? payload.results.slice(0, 8).filter(result => isSafePublicUrl(result.url)).map(result => ({
          title: result.title || 'Untitled',
          url: result.url,
          snippet: result.content || result.snippet || '',
          engine: result.engine || 'searxng',
        }))
      : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function extractPage(sourceUrl, fallbackTitle) {
  if (!isSafePublicUrl(sourceUrl)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'QuillEvidenceBot/0.1 (+https://quill.example)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe, noscript, svg, [aria-hidden="true"]').remove();
    const title = $('h1').first().text().trim() || $('title').text().trim() || fallbackTitle;
    const paragraphs = [];
    $('article p, main p, blockquote, p').each((_index, node) => {
      const text = $(node).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 50 && text.length <= 900) paragraphs.push(text);
    });
    return { url: sourceUrl, title, domain: extractDomain(sourceUrl), paragraphs: [...new Set(paragraphs)].slice(0, 20) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function rankQuotes(query, pages) {
  const terms = query.toLowerCase().split(/\W+/).filter(term => term.length > 2);
  const candidates = [];
  for (const page of pages.filter(Boolean)) {
    for (const text of page.paragraphs) {
      if (/cookie|privacy policy|all rights reserved|subscribe|sign up/i.test(text)) continue;
      const lower = text.toLowerCase();
      const termHits = terms.filter(term => lower.includes(term)).length;
      const quoteSignal = /[“"]/u.test(text) || /\b(said|told|recalled|according to|stated)\b/i.test(text);
      const score = Math.min(100, 28 + termHits * 12 + (quoteSignal ? 18 : 0) + (/\d/.test(text) ? 8 : 0) + (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text) ? 6 : 0));
      if (score >= 50) candidates.push({ verbatimQuote: text, sourceUrl: page.url, authorOrPublisher: page.domain, qualityScore: score });
    }
  }
  const seen = new Set();
  return candidates.sort((left, right) => right.qualityScore - left.qualityScore).filter(candidate => {
    const key = candidate.verbatimQuote.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8).map((quote, index) => ({ ...quote, id: `Q${index + 1}` }));
}

module.exports = { extractDomain, extractPage, isSafePublicUrl, rankQuotes, searchSearxng };

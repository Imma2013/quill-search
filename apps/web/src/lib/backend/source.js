function extractDomain(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

function fallbackFavicon(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    return `${parsed.protocol}//${parsed.host}/favicon.ico`;
  } catch {
    return undefined;
  }
}

const queryStopWords = new Set(['about', 'after', 'also', 'among', 'and', 'are', 'been', 'being', 'between', 'but', 'did', 'does', 'doing', 'early', 'for', 'from', 'have', 'how', 'into', 'itself', 'its', 'like', 'more', 'other', 'than', 'that', 'the', 'their', 'them', 'then', 'these', 'they', 'this', 'those', 'through', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'with', 'would']);

function queryTerms(query) {
  return [...new Set(query.toLowerCase().split(/\W+/).filter(term => term.length > 2 && !queryStopWords.has(term)))];
}

function sentenceCandidates(paragraph) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?:[””'”']+)?/g)?.map(sentence => sentence.trim()) || [paragraph];
  const candidates = [];
  let current = '';
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= 360) {
      current = next;
      if (current.length >= 70) candidates.push(current);
    } else {
      if (current.length >= 70) candidates.push(current);
      current = sentence;
      if (current.length >= 70) candidates.push(current);
    }
  }
  return candidates.length ? candidates : paragraph.length >= 70 && paragraph.length <= 360 ? [paragraph] : [];
}

function rankQuotes(query, pages) {
  const terms = queryTerms(query);
  const minimumTermHits = terms.length > 3 ? 2 : 1;
  const candidates = [];
  for (const page of pages.filter(Boolean)) {
    for (const text of page.paragraphs) {
      if (/cookie|privacy policy|all rights reserved|subscribe|sign up/i.test(text)) continue;
      for (const excerpt of sentenceCandidates(text)) {
        const lower = excerpt.toLowerCase();
        const termHits = terms.filter(term => lower.includes(term)).length;
        if (termHits < minimumTermHits) continue;
        const quoteSignal = /[“"]/u.test(excerpt) || /\b(said|told|recalled|according to|stated)\b/i.test(excerpt);
        const score = Math.min(100, 20 + termHits * 18 + (quoteSignal ? 18 : 0) + (/\d/.test(excerpt) ? 8 : 0) + (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(excerpt) ? 6 : 0));
        if (score >= 50) candidates.push({ verbatimQuote: excerpt, sourceUrl: page.url, authorOrPublisher: page.publisher || page.domain, qualityScore: score });
      }
    }
  }
  const seen = [];
  const sourceCounts = new Map();
  return candidates.sort((left, right) => right.qualityScore - left.qualityScore).filter(candidate => {
    const key = candidate.verbatimQuote.toLowerCase();
    const count = sourceCounts.get(candidate.sourceUrl) || 0;
    if (seen.some(previous => previous.includes(key) || key.includes(previous)) || count >= 2) return false;
    seen.push(key);
    sourceCounts.set(candidate.sourceUrl, count + 1);
    return true;
  }).slice(0, 6).map((quote, index) => ({ ...quote, id: `Q${index + 1}` }));
}

async function searchTavily(query) {
  const apiKey = process.env.TAVILY_API_KEY || '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';
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        include_raw_content: false,
        max_results: 5
      })
    });
    const data = await response.json();
    if (!data.results) return [];
    
    // Custom Scrape Phase: Fetch raw HTML for the top results concurrently
    const scrapedResults = await Promise.all(data.results.map(async (item) => {
      let fullText = item.content || '';
      try {
        const fetchRes = await fetch(item.url, { signal: AbortSignal.timeout(3500) });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
          fullText = body
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch (err) {
        console.warn(`Failed to custom scrape ${item.url}:`, err.message);
      }
      
      return {
        url: item.url,
        title: item.title,
        domain: extractDomain(item.url),
        publisher: extractDomain(item.url),
        faviconUrl: fallbackFavicon(item.url),
        paragraphs: fullText.split(/(?<=\.)\s+/)
          .filter(text => text.length >= 50 && text.length <= 900)
          .slice(0, 30) // Take up to 30 sentences/paragraphs from the scraped text
      };
    }));
    
    return scrapedResults;
  } catch (error) {
    console.error('Tavily error:', error);
    return [];
  }
}

module.exports = { extractDomain, fallbackFavicon, queryTerms, rankQuotes, sentenceCandidates, searchTavily };

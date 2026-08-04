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

async function searchFirecrawl(query) {
  const apiKey = process.env.FIRECRAWL_API_KEY || 'fc-8e1e7eaf4d5b4102be4fe88c62c72872';
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { onlyMainContent: true, formats: ["markdown"] }
      })
    });
    const data = await response.json();
    if (!data.success || !Array.isArray(data.data?.web)) return [];
    
    return data.data.web.map(item => ({
      url: item.url,
      title: item.title,
      domain: extractDomain(item.url),
      publisher: item.metadata?.ogSiteName || extractDomain(item.url),
      faviconUrl: fallbackFavicon(item.url),
      paragraphs: String(item.markdown || item.description || '').split(/\n{2,}/)
        .map(text => text.replace(/\s+/g, ' ').trim())
        .filter(text => text.length >= 50 && text.length <= 900).slice(0, 20)
    }));
  } catch (error) {
    console.error('Firecrawl error:', error);
    return [];
  }
}

module.exports = { extractDomain, fallbackFavicon, queryTerms, rankQuotes, sentenceCandidates, searchFirecrawl };

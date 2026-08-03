const { scrapeWithPlaywright } = require('./playwrightScraper');

async function queryDuckDuckGoMcp(query) {
  const endpoint = process.env.DDG_MCP_SEARCH_URL;
  if (!endpoint) return [];
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.results) ? payload.results : [];
  } catch {
    return [];
  }
}

async function extractWithPlaywright(sourceUrl) {
  try {
    const data = await scrapeWithPlaywright(sourceUrl);
    if (!data) return null;
    return { text: data.content, title: data.title };
  } catch {
    return null;
  }
}

module.exports = { extractWithPlaywright, queryDuckDuckGoMcp };

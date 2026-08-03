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
  const endpoint = process.env.PLAYWRIGHT_EXTRACTOR_URL;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sourceUrl }) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

module.exports = { extractWithPlaywright, queryDuckDuckGoMcp };

let client;

function getClient() {
  if (!process.env.CONVEX_URL) return null;
  if (client) return client;
  const { ConvexHttpClient } = require('convex/browser');
  client = new ConvexHttpClient(process.env.CONVEX_URL);
  return client;
}

async function readCache(cacheKey) {
  const convex = getClient();
  if (!convex || !process.env.CONVEX_SEARCH_TOKEN) return null;
  try {
    return await convex.query('searches:findCachedSearch', { cacheKey, now: Date.now(), capability: process.env.CONVEX_SEARCH_TOKEN });
  } catch (error) {
    console.warn('Convex cache read failed:', error.message);
    return null;
  }
}

async function saveSearch(payload) {
  const convex = getClient();
  if (!convex || !process.env.CONVEX_SEARCH_TOKEN) return;
  try {
    await convex.mutation('searches:saveSearch', { ...payload, capability: process.env.CONVEX_SEARCH_TOKEN });
  } catch (error) {
    console.warn('Convex search write failed:', error.message);
  }
}

module.exports = { readCache, saveSearch };

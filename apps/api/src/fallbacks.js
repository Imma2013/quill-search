const { scrapeWithPlaywright } = require('./playwrightScraper');

const cheerio = require('cheerio');

async function queryDuckDuckGoMcp(query) {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    $('.result').each((i, el) => {
      const url = $(el).find('.result__url').attr('href');
      const title = $(el).find('.result__title').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url && title) {
        let finalUrl = url;
        if (url.startsWith('//duckduckgo.com/l/?')) {
          try {
            const params = new URLSearchParams(url.split('?')[1]);
            if (params.has('uddg')) finalUrl = decodeURIComponent(params.get('uddg'));
          } catch (e) {}
        }
        results.push({ url: finalUrl, title, snippet, engine: 'duckduckgo-html' });
      }
    });
    return results;
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

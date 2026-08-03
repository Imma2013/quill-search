const { chromium } = require('playwright');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});
turndownService.remove(['script', 'style', 'noscript']);

async function scrapeWithPlaywright(url) {
  let browser;
  try {
    // Launch headless chromium
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Set a timeout of 15 seconds to prevent hanging
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait briefly for client-side rendering (React/Vue/etc)
    await page.waitForTimeout(2000);
    
    // Extract fully rendered HTML
    const html = await page.content();
    
    // Parse the HTML to extract only the main article content
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    
    if (!article || !article.content) {
      throw new Error('Could not parse article content from the page.');
    }
    
    // Convert the HTML to clean Markdown
    const markdown = turndownService.turndown(article.content);
    
    return {
      title: article.title,
      content: markdown,
      url
    };
  } catch (error) {
    console.error(`Playwright scraping failed for ${url}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeWithPlaywright };

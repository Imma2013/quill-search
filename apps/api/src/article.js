function parseArticleJson(content) {
  const trimmed = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed);
}

function cleanText(value, minimum, maximum) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < minimum || text.length > maximum || /\[\[|\]\]/.test(text)) return null;
  return text;
}

function validateIds(values, allowed, maximum) {
  if (!Array.isArray(values) || values.length === 0 || values.length > maximum) return null;
  const ids = [...new Set(values.filter(value => typeof value === 'string'))];
  return ids.length === values.length && ids.every(id => allowed.has(id)) ? ids : null;
}

function validateOptionalIds(values, allowed, maximum) {
  if (!Array.isArray(values) || values.length > maximum) return null;
  const ids = [...new Set(values.filter(value => typeof value === 'string'))];
  return ids.length === values.length && ids.every(id => allowed.has(id)) ? ids : null;
}

function validateArticle(content, sources, quotes) {
  const parsed = parseArticleJson(content);
  const sourceIds = new Set(sources.map(source => source.id));
  const quoteIds = new Set(quotes.map(quote => quote.id));
  const intro = cleanText(parsed.intro, 25, 700);
  if (!intro || !Array.isArray(parsed.sections) || parsed.sections.length < 1 || parsed.sections.length > 4) throw new Error('The answer model returned an incomplete article.');

  const sections = parsed.sections.map(section => {
    const heading = cleanText(section?.heading, 3, 100);
    if (!heading || !Array.isArray(section.paragraphs) || section.paragraphs.length < 1 || section.paragraphs.length > 3) throw new Error('The answer model returned an invalid section.');
    const paragraphs = section.paragraphs.map(paragraph => {
      const text = cleanText(paragraph?.text, 20, 700);
      const evidenceSourceIds = validateIds(paragraph?.sourceIds, sourceIds, 3);
      if (!text || !evidenceSourceIds) throw new Error('The answer model returned an uncited claim.');
      return { text, sourceIds: evidenceSourceIds };
    });
    const evidenceQuoteIds = section.quoteIds === undefined ? [] : validateOptionalIds(section.quoteIds, quoteIds, 2);
    if (evidenceQuoteIds === null) throw new Error('The answer model referenced an unavailable quote.');
    return { heading, paragraphs, quoteIds: evidenceQuoteIds };
  });

  if (!sections.some(section => section.quoteIds.length)) throw new Error('The answer model did not use any source excerpts.');
  return { intro, sections };
}

function fallbackArticle(quotes) {
  const firstQuote = quotes[0];
  const secondQuote = quotes[1];
  if (!firstQuote) throw new Error('No evidence excerpts were available.');
  return {
    intro: 'Quill found relevant source evidence, but could not safely turn it into a complete synthesis. The excerpts below are the clearest material to review directly.',
    sections: [{
      heading: 'What the sources say',
      paragraphs: [{ text: 'Start with these direct excerpts from the sources used for this search.', sourceIds: [...new Set(secondQuote ? [firstQuote.sourceId, secondQuote.sourceId] : [firstQuote.sourceId])] }],
      quoteIds: secondQuote ? [firstQuote.id, secondQuote.id] : [firstQuote.id],
    }],
  };
}

module.exports = { fallbackArticle, parseArticleJson, validateArticle };

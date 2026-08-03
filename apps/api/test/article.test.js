const assert = require('node:assert/strict');
const test = require('node:test');
const { validateArticle } = require('../src/article');
const { sentenceCandidates } = require('../src/source');

const sources = [{ id: 'S1', publisher: 'TechCrunch' }, { id: 'S2', publisher: 'The New York Times' }];
const quotes = [{ id: 'Q1', sourceId: 'S1' }, { id: 'Q2', sourceId: 'S2' }];

test('accepts a cited evidence article with stored quote references', () => {
  const article = validateArticle(JSON.stringify({
    intro: 'Instagram differentiated itself by making quick photo sharing feel polished and social on a phone.',
    sections: [{
      heading: 'A focused mobile experience',
      paragraphs: [{ text: 'The early product centered on taking a photo, improving it, and sharing it quickly.', sourceIds: ['S1'] }],
      quoteIds: ['Q1'],
    }, {
      heading: 'Why it mattered',
      paragraphs: [{ text: 'That product focus made the service easier to understand than a broader set of competing tools.', sourceIds: ['S1', 'S2'] }],
      quoteIds: [],
    }],
  }), sources, quotes);
  assert.equal(article.sections[0].quoteIds[0], 'Q1');
  assert.equal(article.sections[0].paragraphs[0].sourceIds[0], 'S1');
});

test('rejects raw marker text and unavailable citations', () => {
  assert.throws(() => validateArticle(JSON.stringify({
    intro: 'Instagram differentiated itself by making quick photo sharing feel polished and social on a phone.',
    sections: [{
      heading: 'A focused mobile experience',
      paragraphs: [{ text: 'This is unsupported [[3]] marker text from a broken response.', sourceIds: ['S9'] }],
      quoteIds: ['Q9'],
    }],
  }), sources, quotes));
});

test('splits long source paragraphs into readable quote candidates', () => {
  const candidates = sentenceCandidates('Instagram made photo sharing faster on the iPhone. Its early filter tools gave ordinary snapshots a more polished look before users posted them to friends.');
  assert.ok(candidates.every(candidate => candidate.length <= 360));
  assert.ok(candidates.length >= 1);
});

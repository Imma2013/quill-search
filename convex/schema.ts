import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const source = v.object({ id: v.string(), title: v.string(), url: v.string(), domain: v.string(), publisher: v.string(), faviconUrl: v.optional(v.string()), snippet: v.string(), quoteCount: v.number() });
const quote = v.object({ id: v.string(), sourceId: v.string(), verbatimQuote: v.string(), sourceUrl: v.string(), authorOrPublisher: v.string(), qualityScore: v.number() });

export default defineSchema({
  searches: defineTable({
    cacheKey: v.string(),
    query: v.string(),
    answerMarkdown: v.string(),
    sources: v.array(source),
    quotes: v.array(quote),
    modelUsed: v.string(),
    expiresAt: v.number(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_cacheKey', ['cacheKey']).index('by_userId', ['userId']),
});

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const source = v.object({ id: v.string(), title: v.string(), url: v.string(), domain: v.string(), publisher: v.string(), faviconUrl: v.optional(v.string()), snippet: v.string(), quoteCount: v.number() });
const quote = v.object({ id: v.string(), sourceId: v.string(), verbatimQuote: v.string(), sourceUrl: v.string(), authorOrPublisher: v.string(), qualityScore: v.number() });
const capability = v.string();

function requireCapability(value: string) {
  if (!process.env.CONVEX_SEARCH_TOKEN || value !== process.env.CONVEX_SEARCH_TOKEN) throw new Error('Unauthorized search persistence request.');
}

export const findCachedSearch = query({
  args: { cacheKey: v.string(), now: v.number(), capability },
  handler: async (ctx, args) => {
    requireCapability(args.capability);
    const record = await ctx.db.query('searches').withIndex('by_cacheKey', query => query.eq('cacheKey', args.cacheKey)).order('desc').first();
    return record && record.expiresAt > args.now ? record : null;
  },
});

export const saveSearch = mutation({
  args: { cacheKey: v.string(), query: v.string(), answerMarkdown: v.string(), sources: v.array(source), quotes: v.array(quote), modelUsed: v.string(), expiresAt: v.number(), userId: v.optional(v.string()), capability },
  handler: async (ctx, args) => {
    requireCapability(args.capability);
    const { capability: _capability, ...record } = args;
    return ctx.db.insert('searches', { ...record, createdAt: Date.now() });
  },
});

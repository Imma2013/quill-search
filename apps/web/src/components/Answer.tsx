'use client';

import { useState } from 'react';
import type { EvidenceArticle, EvidenceQuote, Source } from '@/lib/types';

function SourceMark({ source, compact = false }: { source: Source; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const letter = source.publisher.slice(0, 1).toUpperCase() || source.domain.slice(0, 1).toUpperCase();
  return <span className={compact ? 'inline-flex items-center gap-1' : 'flex items-center gap-2'}>
    {!failed && source.faviconUrl ? <img src={source.faviconUrl} alt="" className="h-4 w-4 rounded-sm" onError={() => setFailed(true)} /> : <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-sm bg-slate-200 text-[9px] font-bold text-slate-700">{letter}</span>}
    <span className="truncate">{compact ? source.publisher : source.domain}</span>
  </span>;
}

function Citation({ source }: { source: Source }) {
  return <a href={source.url} target="_blank" rel="noreferrer" className="mx-1 inline-flex max-w-[11rem] translate-y-[-0.05rem] items-center rounded-full bg-stone-100 px-1.5 py-0.5 text-[0.68rem] font-medium leading-none text-slate-600 transition hover:bg-amber-100 hover:text-slate-900" aria-label={`Open ${source.publisher}`}>
    <SourceMark source={source} compact />
  </a>;
}

function Quote({ quote, source }: { quote: EvidenceQuote; source?: Source }) {
  return <figure className="my-7 border-l-2 border-amber-500 pl-5 sm:pl-6">
    <blockquote className="font-serif text-xl leading-relaxed text-slate-800 sm:text-2xl">“{quote.verbatimQuote}”</blockquote>
    <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 border-b border-slate-400 pb-0.5 text-sm text-slate-600 transition hover:border-amber-600 hover:text-slate-950">
      {source && <SourceMark source={source} compact />}
      <span>— {quote.authorOrPublisher}</span>
    </a>
  </figure>;
}

export function Answer({ article, quotes, sources }: { article: EvidenceArticle; quotes: EvidenceQuote[]; sources: Source[] }) {
  const quoteMap = new Map(quotes.map(quote => [quote.id, quote]));
  const sourceMap = new Map(sources.map(source => [source.id, source]));
  return <article className="mx-auto max-w-3xl pb-12">
    <p className="mb-10 font-serif text-2xl leading-relaxed text-slate-800 sm:text-3xl">{article.intro}</p>
    {article.sections.map((section, sectionIndex) => <section key={`${sectionIndex}-${section.heading}`} className="mb-11 last:mb-0">
      <h2 className="mb-5 font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{section.heading}</h2>
      {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className="mb-5 font-serif text-lg leading-8 text-slate-700 sm:text-xl sm:leading-9">
        {paragraph.text}
        {paragraph.sourceIds.map(sourceId => {
          const source = sourceMap.get(sourceId);
          return source ? <Citation key={sourceId} source={source} /> : null;
        })}
      </p>)}
      {section.quoteIds.map(quoteId => {
        const quote = quoteMap.get(quoteId);
        return quote ? <Quote key={quoteId} quote={quote} source={sourceMap.get(quote.sourceId)} /> : null;
      })}
    </section>)}
  </article>;
}

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return <section className="mx-auto max-w-4xl border-t border-stone-200 pt-8">
    <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sources used</p>
    <div className="flex gap-3 overflow-x-auto pb-2">
      {sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="min-w-64 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-amber-500 hover:shadow-sm">
        <div className="mb-3 text-xs text-slate-500"><SourceMark source={source} /></div>
        <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800">{source.title}</p>
        <p className="mt-3 text-xs text-amber-700">{source.quoteCount} evidence excerpt{source.quoteCount === 1 ? '' : 's'}</p>
      </a>)}
    </div>
  </section>;
}

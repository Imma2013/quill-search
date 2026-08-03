import type { EvidenceQuote, Source } from '@/lib/types';

function Quote({ quote }: { quote: EvidenceQuote }) {
  return <figure className="my-6 border-l-2 border-amber-500 pl-5">
    <blockquote className="font-serif text-xl leading-relaxed text-slate-800">“{quote.verbatimQuote}”</blockquote>
    <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block border-b border-amber-500 text-xs font-bold uppercase tracking-wide text-slate-700 hover:text-amber-700">— {quote.authorOrPublisher}</a>
  </figure>;
}

export function Answer({ markdown, quotes }: { markdown: string; quotes: EvidenceQuote[] }) {
  const quoteMap = new Map(quotes.map(quote => [quote.id, quote]));
  const sections = markdown.split(/(?=^###\s)/m);
  return <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-10">
    {sections.map((section, sectionIndex) => {
      const lines = section.split('\n').map(line => line.trim()).filter(Boolean);
      return <section key={`${sectionIndex}-${lines[0] || ''}`} className="mb-9 last:mb-0">
        {lines.map((line, lineIndex) => {
          if (line.startsWith('### ')) return <h2 key={lineIndex} className="mb-4 font-serif text-2xl font-bold tracking-tight text-slate-950">{line.slice(4)}</h2>;
          const quoteMatch = line.match(/^\[\[quote:(Q\d+)\]\]$/);
          if (quoteMatch) {
            const quote = quoteMap.get(quoteMatch[1]);
            return quote ? <Quote key={lineIndex} quote={quote} /> : null;
          }
          return <p key={lineIndex} className="mb-4 leading-7 text-slate-700">{line}</p>;
        })}
      </section>;
    })}
  </article>;
}

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return <section className="mb-6">
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sources used</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-amber-500 hover:shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500"><img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(source.domain)}&sz=32`} alt="" className="h-4 w-4" /><span className="truncate">{source.domain}</span></div>
        <p className="line-clamp-3 text-sm font-bold leading-5 text-slate-800">{source.title}</p>
        <p className="mt-3 text-xs text-amber-700">{source.quoteCount} evidence excerpt{source.quoteCount === 1 ? '' : 's'}</p>
      </a>)}
    </div>
  </section>;
}

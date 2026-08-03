'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import SearchForm from '@/components/SearchForm';
import { Answer, Sources } from '@/components/Answer';
import { auth } from '@/lib/firebase';
import type { SearchMetadata } from '@/lib/types';

const examples = [
  'What did Instagram do to differentiate itself from early photo-sharing apps?',
  'How did consumer apps get their first 1,000 users?',
  'What does the evidence say about AI search hallucinations?',
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [metadata, setMetadata] = useState<SearchMetadata>({ sources: [], quotes: [], cached: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (nextQuery: string) => {
    setQuery(nextQuery);
    setAnswer('');
    setMetadata({ sources: [], quotes: [], cached: false });
    setError('');
    setBusy(true);
    try {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
      const response = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query: nextQuery }) });
      if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => ({ error: 'Search could not start.' }));
        throw new Error(failure.error || 'Search could not start.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let metadataRead = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!metadataRead) {
          const divider = buffer.indexOf('\n---META---\n');
          if (divider === -1) continue;
          const metadataText = buffer.slice(0, divider);
          const parsed = JSON.parse(metadataText) as SearchMetadata;
          setMetadata(parsed);
          buffer = buffer.slice(divider + '\n---META---\n'.length);
          metadataRead = true;
        }
        if (metadataRead && buffer) {
          setAnswer(current => current + buffer);
          buffer = '';
        }
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const showingResult = Boolean(query);
  return <main className="min-h-screen bg-[#fbfaf7]">
    <Header />
    {!showingResult ? <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-3xl flex-col justify-center px-5 pb-20 text-center">
      <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Search that shows its work</p>
      <h1 className="font-serif text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">An answer should earn your trust.</h1>
      <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-600">Quill writes the connective tissue, then gives the original sources room to speak.</p>
      <div className="mx-auto mt-9 w-full max-w-2xl"><SearchForm onSearch={search} busy={busy} /></div>
      <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {examples.map(example => <button key={example} onClick={() => search(example)} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-amber-500 hover:text-slate-900">{example}</button>)}
      </div>
    </section> : <section className="mx-auto max-w-5xl px-5 py-10 md:py-14">
      <div className="mb-8"><SearchForm onSearch={search} busy={busy} initialQuery={query} /></div>
      <div className="mb-8 border-b border-stone-200 pb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Evidence brief {metadata.cached ? '· cached' : ''}</p>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{query}</h1>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</div> : <>
        <Sources sources={metadata.sources} />
        {answer ? <Answer markdown={answer} quotes={metadata.quotes} /> : <div className="rounded-2xl border border-stone-200 bg-white p-8 text-slate-500">{busy ? 'Quill is gathering source evidence…' : 'No answer returned.'}</div>}
      </>}
    </section>}
  </main>;
}

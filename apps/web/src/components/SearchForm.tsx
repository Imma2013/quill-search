'use client';

import { ArrowRight, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';

export default function SearchForm({ onSearch, busy, initialQuery = '' }: { onSearch: (query: string) => void; busy: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim() && !busy) onSearch(query.trim());
  };
  return <form onSubmit={submit} className="w-full">
    <div className="flex items-center gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm transition focus-within:border-slate-600 focus-within:ring-4 focus-within:ring-slate-900/5">
      <Search className="ml-3 text-slate-400" size={20} />
      <input value={query} onChange={event => setQuery(event.target.value)} disabled={busy} placeholder="Ask a question worth checking" className="min-w-0 flex-1 bg-transparent px-2 py-2 text-slate-900 outline-none placeholder:text-slate-400" />
      <button disabled={!query.trim() || busy} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-700 disabled:bg-stone-300" aria-label="Search">
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRight size={18} />}
      </button>
    </div>
  </form>;
}

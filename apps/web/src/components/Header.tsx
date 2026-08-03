'use client';

import { Feather, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth, firebaseConfigured, googleProvider } from '@/lib/firebase';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);
  const authenticate = async () => {
    if (!auth) return;
    if (user) await signOut(auth);
    else await signInWithPopup(auth, googleProvider);
  };
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#fbfaf7]/90 px-5 py-4 backdrop-blur md:px-10">
      <a href="/" className="flex items-center gap-3 font-serif text-xl font-bold tracking-tight text-slate-900">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-amber-300"><Feather size={18} /></span>
        Quill
      </a>
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="hidden items-center gap-1.5 sm:flex"><ShieldCheck size={15} className="text-emerald-600" />Evidence-first answers</span>
        {firebaseConfigured && <button onClick={authenticate} className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 font-semibold text-slate-700 hover:border-slate-700">
          {user ? <><LogOut size={14} />Sign out</> : <><LogIn size={14} />Sign in</>}
        </button>}
      </div>
    </header>
  );
}

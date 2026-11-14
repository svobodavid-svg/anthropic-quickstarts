'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Access {
  /** Null in local mode (Supabase not configured). */
  user: User | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AccessContext = createContext<Access>({ user: null, isAdmin: false, signOut: async () => undefined });

export const useAccess = () => useContext(AccessContext);

type Status = 'loading' | 'signed-out' | 'not-invited' | 'ready';

const inputClass =
  'w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500';

/**
 * With Supabase configured, the studio is invite-only: a visitor must sign in and their
 * e-mail must be on the `allowed_emails` list. The list is enforced by database policies;
 * this screen only reflects it.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>(supabase ? 'loading' : 'ready');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const checkAccess = useCallback(async (nextUser: User | null) => {
    if (!supabase) return;
    setUser(nextUser);
    if (!nextUser?.email) {
      setIsAdmin(false);
      setStatus('signed-out');
      return;
    }
    const { data, error: queryError } = await supabase
      .from('allowed_emails')
      .select('is_admin')
      .eq('email', nextUser.email.toLowerCase())
      .maybeSingle();
    if (queryError) {
      setError('Nepodařilo se ověřit přístup. Zkuste to znovu.');
      setStatus('signed-out');
      return;
    }
    setIsAdmin(!!data?.is_admin);
    setStatus(data ? 'ready' : 'not-invited');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => checkAccess(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer: Supabase calls must not run inside the auth callback.
      setTimeout(() => checkAccess(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [checkAccess]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw new Error('Přihlášení se nezdařilo. Zkontrolujte e-mail a heslo.');
      } else {
        if (password.length < 8) throw new Error('Heslo musí mít alespoň 8 znaků.');
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw new Error('Účet se nepodařilo vytvořit. Zkuste to později.');
        setMessage('Pokud je e-mail v pořádku, přišel vám potvrzovací odkaz. Po potvrzení se přihlaste.');
        setMode('sign-in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala chyba.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'ready') {
    return <AccessContext.Provider value={{ user, isAdmin, signOut }}>{children}</AccessContext.Provider>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-2">🎬</div>
          <h1 className="text-2xl font-bold text-white">Multimedia Studio</h1>
          <p className="text-slate-400 text-sm mt-1">Soukromé studio, přístup jen pro pozvané</p>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-6">
            <Loader className="w-6 h-6 text-blue-400 animate-spin" aria-label="Načítání" />
          </div>
        )}

        {status === 'not-invited' && (
          <div className="space-y-4 text-center">
            <p className="text-slate-200">
              Účet <span className="font-medium">{user?.email}</span> nemá pozvánku.
            </p>
            <p className="text-sm text-slate-400">Požádejte správce studia, aby váš e-mail přidal.</p>
            <button onClick={signOut} className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2">
              Odhlásit
            </button>
          </div>
        )}

        {status === 'signed-out' && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-slate-300 mb-1">
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-slate-300 mb-1">
                Heslo
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-green-400">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2"
            >
              {busy ? 'Moment...' : mode === 'sign-in' ? 'Přihlásit se' : 'Vytvořit účet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setError('');
              }}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              {mode === 'sign-in' ? 'Mám pozvánku a ještě nemám účet' : 'Už účet mám, přihlásit se'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

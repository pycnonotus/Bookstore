import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '../api/auth';

const inputClass = 'mt-2 w-full rounded-lg border border-spruce/25 bg-white px-4 py-3 text-ink disabled:opacity-60';

export default function AuthPage({ mode }) {
  const registering = mode === 'register';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPath = searchParams.get('returnTo') || '';
  const returnTo = /^\/(cart|orders(?:\/[0-9a-f-]{36})?)$/i.test(requestedPath) ? requestedPath : '/';
  const { data: session, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    document.title = `${registering ? 'Create account' : 'Log in'} · Book Library`;
    return () => { document.title = 'Book Library'; };
  }, [registering]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = form.get('email').trim();
    const password = form.get('password');
    const name = form.get('name')?.trim();
    setError('');
    if (registering && !name) return setError('Please enter your name.');
    if (registering && password !== form.get('confirmPassword')) return setError('Your passwords do not match.');
    setBusy(true);
    try {
      const result = registering
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password, rememberMe: true });
      if (result.error) {
        if (result.error.status === 429) setError('Too many attempts. Please wait a minute and try again.');
        else if (!registering) setError('Unable to log in. Check your email and password and try again.');
        else setError(result.error.message || 'Unable to create your account. Please try again.');
        return;
      }
      navigate(returnTo, { replace: true });
    } catch {
      setError('We could not connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <p role="status" className="mx-auto max-w-md px-6 py-20">Checking your session…</p>;
  if (session) return <Navigate to={returnTo} replace />;

  return <section className="mx-auto w-full max-w-lg px-4 py-12 sm:py-20" aria-labelledby="auth-title">
    <div className="rounded-2xl border border-spruce/15 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-widest text-spruce">Book Library</p>
      <h1 id="auth-title" className="mt-3 font-serif text-3xl text-spruce-deep">{registering ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-3 text-sm leading-6 text-ink/70">{registering ? 'A new chapter starts here. Join our community of readers.' : 'Log in to your Book Library account.'}</p>
      <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
        {registering && <label className="block text-sm font-semibold">Name
          <input className={inputClass} name="name" autoComplete="name" required maxLength={100} disabled={busy} />
        </label>}
        <label className="block text-sm font-semibold">Email
          <input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} />
        </label>
        <label className="block text-sm font-semibold">Password
          <input className={inputClass} name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : undefined} maxLength={128} disabled={busy} aria-describedby={registering ? 'password-hint' : undefined} />
        </label>
        {registering && <>
          <p id="password-hint" className="text-xs text-ink/65">Use between 8 and 128 characters.</p>
          <label className="block text-sm font-semibold">Confirm password
            <input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} disabled={busy} />
          </label>
        </>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-spruce px-5 py-3 font-semibold text-white hover:bg-spruce-deep disabled:cursor-wait disabled:opacity-60">
          {busy ? (registering ? 'Creating account…' : 'Logging in…') : (registering ? 'Create account' : 'Log in')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink/70">
        {registering ? 'Already have an account? ' : 'New to Book Library? '}
        <Link className="font-semibold text-spruce underline" to={`${registering ? '/login' : '/register'}?returnTo=${encodeURIComponent(returnTo)}`}>{registering ? 'Log in' : 'Create an account'}</Link>
      </p>
    </div>
  </section>;
}

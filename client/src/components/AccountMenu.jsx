import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authClient } from '../api/auth';

export default function AccountMenu() {
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  async function logout() {
    setBusy(true);
    setLogoutError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('Sign out failed');
      navigate('/', { replace: true });
    } catch { setLogoutError('Could not log out. Please try again.'); }
    finally { setBusy(false); }
  }

  if (isPending) return <span role="status" className="text-sm text-ink/65">Checking account…</span>;
  if (error) return <button onClick={() => refetch()} className="text-sm text-spruce underline">Retry account connection</button>;
  return <div className="flex flex-wrap items-center gap-3 text-sm">
    {session ? <>
      <Link to="/orders" className="font-semibold text-spruce hover:underline">My orders</Link>
      <span className="max-w-40 truncate" title={session.user.name}>Hello, {session.user.name}</span>
      <button type="button" disabled={busy} onClick={logout} className="rounded-lg border border-spruce/30 px-3 py-2 font-semibold text-spruce disabled:opacity-60">{busy ? 'Logging out…' : 'Log out'}</button>
      {logoutError && <p role="alert" className="w-full text-red-800">{logoutError}</p>}
    </> : <>
      <Link to="/login" className="font-semibold text-spruce hover:underline">Log in</Link>
      <Link to="/register" className="rounded-lg bg-spruce px-3 py-2 font-semibold text-white hover:bg-spruce-deep">Register</Link>
    </>}
  </div>;
}

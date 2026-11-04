import { Navigate, useLocation } from 'react-router-dom';
import { authClient } from '../api/auth';

export default function RequireSession({ children }) {
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const { pathname } = useLocation();
  if (isPending) return <p role="status" className="px-6 py-16 text-center">Checking your session…</p>;
  if (error) return <div role="alert" className="px-6 py-16 text-center">Could not check your account. <button onClick={() => refetch()} className="text-spruce underline">Try again</button></div>;
  if (!session) return <Navigate to={`/login?returnTo=${encodeURIComponent(pathname)}`} replace />;
  return <div key={session.user.id}>{children}</div>;
}

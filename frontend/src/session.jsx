import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { get } from './api';

/* Who is logged in, plus the two counts the nav badges read.

   /api/me is the single source of truth for all of it, so anything that
   changes a badge — applying, accepting, responding to an invite — calls
   refresh() afterwards instead of guessing at the new number. */

const SessionContext = createContext(null);

const EMPTY = { logged_in: false };

export function SessionProvider({ children }) {
  const [data, setData] = useState(null);      // null while the first load runs

  const refresh = useCallback(async () => {
    const fresh = await get('/api/me').catch(() => EMPTY);
    setData(fresh);
    return fresh;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = {
    loading: data === null,
    me: data && data.logged_in ? data.user : null,
    notifications: (data && data.notifications) || 0,
    pendingApplications: (data && data.pending_applications) || 0,
    profileComplete: !!(data && data.profile_complete),
    demoMode: !!(data && data.demo_mode),
    refresh,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

/* Gate for the pages that make no sense logged out. Waits for the first
   /api/me rather than bouncing to sign-in on a page refresh, which is what
   redirecting during the loading state would do. */
export function RequireAuth({ children }) {
  const { loading, me } = useSession();
  const location = useLocation();
  if (loading) return null;
  if (!me) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return children;
}

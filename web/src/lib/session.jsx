import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const SessionContext = createContext(null);
const EMPTY_BADGES = { notifications: 0, messages: 0, requests: 0, pendingDuo: false };

export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [badges, setBadges] = useState(EMPTY_BADGES);
  const timer = useRef();

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.get('/auth/session').then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  const refreshBadges = useCallback(() => {
    api.get('/me/badges').then(setBadges).catch(() => {});
  }, []);

  // Sondeo ligero de contadores: cada 20 s y al volver a la app.
  useEffect(() => {
    if (!user) return undefined;
    refreshBadges();
    timer.current = setInterval(() => document.visibilityState === 'visible' && refreshBadges(), 20_000);
    const onFocus = () => refreshBadges();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refreshBadges]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setBadges(EMPTY_BADGES);
  }, []);

  const value = useMemo(() => ({ user, setUser, badges, refreshBadges, logout }), [user, badges, refreshBadges, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

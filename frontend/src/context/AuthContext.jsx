import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { setAccessToken } from '../api/axios';

const AuthContext = createContext(null);

// StrictMode mounts effects twice in development. Reuse the same bootstrap
// promise so two parallel refresh calls cannot race with token rotation.
let bootstrapPromise = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        bootstrapPromise = bootstrapPromise || api.post('/auth/refresh');
        const res = await bootstrapPromise;
        if (!cancelled) {
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        bootstrapPromise = null;
        if (!cancelled) setBooting(false);
      }
    };

    bootstrap();

    const handleForcedLogout = () => {
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener('auth:logout', handleForcedLogout);

    return () => {
      cancelled = true;
      window.removeEventListener('auth:logout', handleForcedLogout);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the network call fails, clear local session state.
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser((current) => ({ ...current, ...updatedUser }));
  }, []);

  const value = {
    user,
    booting,
    login,
    register,
    logout,
    updateUser,
    isAdmin: user?.role === 'admin',
    isReviewer: user?.role === 'admin' || user?.role === 'hr_manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

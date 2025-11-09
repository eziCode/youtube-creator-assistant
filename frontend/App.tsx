import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import { API_BASE_URL } from './constants';
import { AuthenticatedUser } from './types';
import { startDemoSession } from './services/demoService';

type Page = 'landing' | 'login' | 'dashboard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoChannel, setDemoChannel] = useState<unknown>(null);

  const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/session`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Session check failed with status ${response.status}`);
      }

      const data: { authenticated: boolean; user?: AuthenticatedUser; demoMode?: boolean } = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setAuthError(null);
        setIsDemoMode(Boolean(data.demoMode));
        if (!data.demoMode) {
          setDemoChannel(null);
        }
        setCurrentPage('dashboard');
        return true;
      }

      setUser(null);
      setIsDemoMode(false);
      setDemoChannel(null);
      return false;
    } catch (error) {
      console.warn('Unable to verify session', error);
      setUser(null);
      setIsDemoMode(false);
      setDemoChannel(null);
      return false;
    }
  }, [apiBaseUrl]);

  const navigateToLanding = () => {
    setAuthError(null);
    setCurrentPage('landing');
  };

  const navigateToLogin = () => {
    setAuthError(null);
    setCurrentPage('login');
  };

  const handleStartDemo = useCallback(async () => {
    try {
      setAuthError(null);
      const payload = await startDemoSession();
      if (payload?.user) {
        setUser(payload.user as AuthenticatedUser);
      }
      if (payload?.channel) {
        setDemoChannel(payload.channel);
      } else {
        setDemoChannel(null);
      }
      setIsDemoMode(true);
      setCurrentPage('dashboard');
    } catch (error) {
      console.error('Failed to start demo session', error);
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to start demo mode right now. Please try again.'
      );
      setIsDemoMode(false);
      setDemoChannel(null);
      setCurrentPage('login');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to log out cleanly', error);
    } finally {
      setUser(null);
      setIsDemoMode(false);
      setDemoChannel(null);
      setCurrentPage('login');
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialize = async () => {
      const pathname = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const authStatus = params.get('auth');

      if (pathname === '/auth/error' || authStatus === 'error') {
        const message = params.get('message') ?? 'Authentication failed.';
        setAuthError(message);
        setUser(null);
        setCurrentPage('login');
      } else {
        const authenticated = await checkSession();

        if (!authenticated && (pathname === '/auth/success' || authStatus === 'success')) {
          setAuthError('Authentication completed, but the session could not be established. Please try again.');
          setCurrentPage('login');
        }
      }

      window.history.replaceState(null, '', '/');
      setIsInitializing(false);
    };

    void initialize();
  }, [checkSession]);

  if (isInitializing) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-8 py-6 shadow-[0_25px_70px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/60">
            Syncing workspace
          </p>
        </div>
      </div>
    );
  }

  switch (currentPage) {
    case 'landing':
      return (
        <LandingPage
          onLogin={navigateToLogin}
          onStartDemo={handleStartDemo}
          authError={authError ?? undefined}
        />
      );
    case 'login':
      return (
        <LoginPage
          onNavigateToHome={navigateToLanding}
          errorMessage={authError ?? undefined}
        />
      );
    case 'dashboard':
      return (
        <Dashboard
          user={user}
          onLogout={handleLogout}
          isDemoMode={isDemoMode}
          demoChannel={demoChannel}
          onUpdateDemoChannel={setDemoChannel}
        />
      );
    default:
      return (
        <LandingPage
          onLogin={navigateToLogin}
          onStartDemo={handleStartDemo}
          authError={authError ?? undefined}
        />
      );
  }
};

export default App;
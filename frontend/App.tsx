import React, { useCallback, useEffect, useMemo, useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import { API_BASE_URL } from './constants';
import { AuthenticatedUser } from './types';

type Page = 'landing' | 'login' | 'dashboard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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

      const data: { authenticated: boolean; user?: AuthenticatedUser } = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setAuthError(null);
        setCurrentPage('dashboard');
        return true;
      }

      setUser(null);
      return false;
    } catch (error) {
      console.warn('Unable to verify session', error);
      setUser(null);
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

  const navigateToDashboard = () => {
    setAuthError(null);
    setCurrentPage('dashboard');
  };

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
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  switch (currentPage) {
    case 'landing':
      return (
        <LandingPage
          onLogin={navigateToLogin}
          onGoToDashboard={navigateToDashboard}
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
      return <Dashboard user={user} onLogout={handleLogout} />;
    default:
      return (
        <LandingPage
          onLogin={navigateToLogin}
          onGoToDashboard={navigateToDashboard}
        />
      );
  }
};

export default App;
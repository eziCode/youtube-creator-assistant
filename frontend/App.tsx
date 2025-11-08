import React, { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

type Page = 'landing' | 'login' | 'dashboard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [authError, setAuthError] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (pathname === '/auth/success') {
      const tokens = {
        accessToken: params.get('access_token') ?? '',
        refreshToken: params.get('refresh_token') ?? '',
        scope: params.get('scope') ?? '',
        tokenType: params.get('token_type') ?? '',
        expiryDate: params.get('expiry_date') ?? '',
        idToken: params.get('id_token') ?? '',
        email: params.get('email') ?? '',
        name: params.get('name') ?? '',
      };

      try {
        window.sessionStorage.setItem(
          'youtubeCreatorAssistant.oauth',
          JSON.stringify(tokens)
        );
      } catch (err) {
        console.warn('Unable to cache OAuth tokens in session storage', err);
      }

      window.history.replaceState(null, '', '/');
      setAuthError(null);
      setCurrentPage('dashboard');
    } else if (pathname === '/auth/error') {
      const message = params.get('message') ?? 'Authentication failed.';
      window.history.replaceState(null, '', '/');
      setAuthError(message);
      setCurrentPage('login');
    }
  }, []);

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
      return <Dashboard />;
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
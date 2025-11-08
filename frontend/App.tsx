import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';

type Page = 'landing' | 'login' | 'signup' | 'dashboard';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  const renderPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage 
          onLogin={() => setCurrentPage('login')} 
          onSignUp={() => setCurrentPage('signup')} 
          // REMOVE-LATER: This prop is for the temporary "Go to Dashboard" button.
          onGoToDashboard={() => setCurrentPage('dashboard')} 
        />;
      case 'login':
        return <LoginPage 
          onLoginSuccess={() => setCurrentPage('dashboard')} 
          onNavigateToSignUp={() => setCurrentPage('signup')} 
          onNavigateToHome={() => setCurrentPage('landing')}
        />;
      case 'signup':
        return <SignUpPage 
          onSignUpSuccess={() => setCurrentPage('dashboard')} 
          onNavigateToLogin={() => setCurrentPage('login')} 
          onNavigateToHome={() => setCurrentPage('landing')}
        />;
      case 'dashboard':
        return <Dashboard />;
      default:
        return <LandingPage 
          onLogin={() => setCurrentPage('login')} 
          onSignUp={() => setCurrentPage('signup')} 
          // REMOVE-LATER: This prop is for the temporary "Go to Dashboard" button.
          onGoToDashboard={() => setCurrentPage('dashboard')} 
        />;
    }
  };

  return (
      <>
        {renderPage()}
      </>
  );
};

export default App;
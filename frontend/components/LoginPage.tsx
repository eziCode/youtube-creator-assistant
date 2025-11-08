import React from 'react';
import { RobotIcon } from './icons';
import { API_BASE_URL } from '../constants';

interface LoginPageProps {
  onNavigateToHome: () => void;
  errorMessage?: string;
}

const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToHome, errorMessage }) => {
  const handleGoogleLogin = () => {
    const sanitizedBaseUrl = API_BASE_URL.replace(/\/$/, '');
    window.location.href = `${sanitizedBaseUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <button 
            onClick={onNavigateToHome} 
            className="w-full text-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg"
            aria-label="Return to homepage"
          >
            <div className="flex flex-col items-center mb-6">
                <div className="p-2 bg-indigo-50 rounded-full mb-3 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <RobotIcon />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 transition-colors group-hover:text-indigo-600">Welcome Back</h2>
                <p className="text-slate-500 text-sm mt-1">Sign in to access your YouTube AI Assistant</p>
            </div>
          </button>
          <div className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-3 px-4 rounded-md bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Continue with Google
            </button>
            <p className="text-xs text-slate-500 text-center">
              You will be redirected to Google to authorize access to your YouTube account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
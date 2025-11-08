import React from 'react';
import { RobotIcon } from './icons';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToSignUp: () => void;
  onNavigateToHome: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigateToSignUp, onNavigateToHome }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess();
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
                <p className="text-slate-500 text-sm mt-1">Login to your YouTube AI Assistant</p>
            </div>
          </button>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email Address</label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                autoComplete="email" 
                required 
                placeholder="you@example.com"
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
            <div>
              <label htmlFor="password"className="block text-sm font-medium text-slate-700">Password</label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                autoComplete="current-password" 
                required 
                placeholder="••••••••"
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
            <div className="pt-2">
              <button 
                type="submit" 
                className="w-full py-2 px-4 rounded-md bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
              >
                Login
              </button>
            </div>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <button onClick={onNavigateToSignUp} className="font-semibold text-indigo-600 hover:text-indigo-500">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
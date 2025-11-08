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
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-12">
        <section className="max-w-xl space-y-8 text-slate-50">
          <button
            onClick={onNavigateToHome}
            className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Return to homepage"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/30 text-indigo-200 transition group-hover:bg-indigo-500/50 group-hover:text-white">
              <RobotIcon />
            </span>
            Back to creator suite
          </button>

          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Your AI teammate for building a thriving YouTube channel.
            </h1>
            <p className="text-base text-slate-300 sm:text-lg">
              Get data-driven ideas, tailored video scripts, and polished shorts ready to post. Let the assistant handle repetitive work so you can focus on creating.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-indigo-200">Smart insights</p>
              <p className="mt-1 text-sm text-slate-200">See what your audience wants next using AI-powered topic discovery.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-indigo-200">Faster production</p>
              <p className="mt-1 text-sm text-slate-200">Generate scripts, thumbnails, and shorts in minutes—not hours.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-indigo-200">Real-time analytics</p>
              <p className="mt-1 text-sm text-slate-200">Track performance trends and stay ahead of algorithm changes.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-indigo-200">Private & secure</p>
              <p className="mt-1 text-sm text-slate-200">OAuth2 with Google keeps your channel data protected at all times.</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/85 p-8 shadow-2xl backdrop-blur">
            <div className="mb-6 space-y-2 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Log in</p>
              <h2 className="text-2xl font-bold text-slate-900">Welcome back, creator</h2>
              <p className="text-sm text-slate-500">
                Connect your Google account to unlock the full suite of AI-driven tools.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <span className="text-base">Continue with Google</span>
            </button>

            <div className="mt-6 space-y-4 text-xs text-slate-500">
              <p className="text-center">
                You will be redirected to Google to authorize access to your YouTube account.
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                <p className="font-medium text-slate-600">OAuth2 secured. We never store your password.</p>
              </div>
              <p className="text-center">
                Need an account? Join the waitlist to get early access to new features.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
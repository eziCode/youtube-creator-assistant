import React, { useMemo } from 'react';

interface AuthResultPageProps {
  variant: 'success' | 'error';
  onBackToLogin: () => void;
}

const AuthResultPage: React.FC<AuthResultPageProps> = ({ variant, onBackToLogin }) => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  if (variant === 'error') {
    const message = params.get('message') ?? 'Authentication failed. Please try again.';

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Authorization Error</h2>
          <p className="text-slate-600">{message}</p>
          <button
            onClick={onBackToLogin}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const tokenEntries = [
    ['Name', params.get('name') ?? ''],
    ['Email', params.get('email') ?? ''],
    ['Access Token', params.get('access_token') ?? ''],
    ['Refresh Token', params.get('refresh_token') ?? ''],
    ['Token Type', params.get('token_type') ?? ''],
    ['Scope', params.get('scope') ?? ''],
    ['Expiry Date', params.get('expiry_date') ?? ''],
    ['ID Token', params.get('id_token') ?? ''],
  ].filter(([, value]) => value);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Authentication Successful</h2>
          <p className="text-slate-600 mt-2">
            Google authorized the application. Review the returned token details below.
          </p>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {tokenEntries.map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold text-slate-700">{label}</dt>
              <dd className="mt-1 text-slate-600 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onBackToLogin}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Back to Login
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).catch(() => {});
            }}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthResultPage;


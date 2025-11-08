import React from 'react';
import { Tone } from '../types';
import Card from './Card';

interface SettingsTabProps {
  tone: Tone;
  setTone: (tone: Tone) => void;
}

const toneOptions: Tone[] = ["Friendly", "Professional", "Comedic", "Sarcastic"];

const SettingsTab: React.FC<SettingsTabProps> = ({ tone, setTone }) => {
  return (
    <section className="space-y-8 text-white">
      <h2 className="text-3xl font-semibold text-white drop-shadow-sm">Settings</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Model / API Keys">
            <div className="space-y-4">
                <div>
                    <label htmlFor="gemini-key" className="block text-sm font-semibold text-white/80">Gemini API Key</label>
                    <input id="gemini-key" type="password" placeholder="•••••••••••••••••••• (mock)" className="mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white/80 shadow-inner shadow-black/40 placeholder-white/30 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                </div>
                <div>
                    <label htmlFor="youtube-key" className="block text-sm font-semibold text-white/80">YouTube Data API Key</label>
                    <input id="youtube-key" type="password" placeholder="•••••••••••••••••••• (mock)" className="mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white/80 shadow-inner shadow-black/40 placeholder-white/30 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                </div>
            </div>
          <p className="mt-4 text-xs text-white/60">Keys are for demo purposes and are not used. Do not commit real keys to source control.</p>
        </Card>
        
        <Card title="AI Tone Presets">
            <p className="mb-4 text-xs text-white/60">
                Select the default tone for AI-generated comment replies.
            </p>
          <fieldset>
            <legend className="sr-only">Notification method</legend>
            <div className="space-y-3">
              {toneOptions.map(option => (
                <div key={option} className="flex items-center gap-3">
                  <input
                    id={option}
                    name="tone-preset"
                    type="radio"
                    checked={tone === option}
                    onChange={() => setTone(option)}
                    className="h-4 w-4 border-white/30 text-indigo-400 focus:ring-indigo-400/60"
                  />
                  <label htmlFor={option} className="text-sm font-semibold text-white/80">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </Card>
      </div>
    </section>
  );
};

export default SettingsTab;

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
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-6">Settings</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Model / API Keys">
            <div className="space-y-3">
                <div>
                    <label htmlFor="gemini-key" className="block text-sm font-medium text-slate-700">Gemini API Key</label>
                    <input id="gemini-key" type="password" placeholder="•••••••••••••••••••• (mock)" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                    <label htmlFor="youtube-key" className="block text-sm font-medium text-slate-700">YouTube Data API Key</label>
                    <input id="youtube-key" type="password" placeholder="•••••••••••••••••••• (mock)" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
            </div>
          <p className="text-xs text-slate-500 mt-3">Keys are for demo purposes and are not used. Do not commit real keys to source control.</p>
        </Card>
        
        <Card title="AI Tone Presets">
            <p className="text-xs text-slate-600 mb-4">
                Select the default tone for AI-generated comment replies.
            </p>
          <fieldset>
            <legend className="sr-only">Notification method</legend>
            <div className="space-y-3">
              {toneOptions.map(option => (
                <div key={option} className="flex items-center">
                  <input
                    id={option}
                    name="tone-preset"
                    type="radio"
                    checked={tone === option}
                    onChange={() => setTone(option)}
                    className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor={option} className="ml-3 block text-sm font-medium text-slate-700">
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

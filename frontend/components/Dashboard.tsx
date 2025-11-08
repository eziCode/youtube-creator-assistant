import React, { useState } from "react";
import { AuthenticatedUser, Tab, Tone, Video } from '../types';
import { MOCK_VIDEOS } from '../constants';
import Sidebar from './Sidebar';
import AnalyticsTab from './AnalyticsTab';
import CommentsTab from './CommentsTab';
import ShortsGeneratorTab from './ShortsGeneratorTab';
import SettingsTab from './SettingsTab';

interface DashboardProps {
  user: AuthenticatedUser | null;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [selectedVideo, setSelectedVideo] = useState<Video>(MOCK_VIDEOS[0]);
  const [tone, setTone] = useState<Tone>('Friendly');

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return <AnalyticsTab videos={MOCK_VIDEOS} />;
      case 'comments':
        return <CommentsTab tone={tone} />;
      case 'shorts':
        return <ShortsGeneratorTab />;
      case 'settings':
        return <SettingsTab tone={tone} setTone={setTone} />;
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="flex items-center justify-between mb-6 px-2 md:px-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">YouTube AI Assistant</h1>
            <p className="text-sm text-slate-500">Hackathon MVP</p>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name ?? user.email}
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold">
                    {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">
                    {user.name ?? user.email}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={onLogout}
              className="px-3 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <Sidebar 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            videos={MOCK_VIDEOS}
          />

          <main className="col-span-12 md:col-span-9">
            <div className="bg-white rounded-xl p-6 shadow-sm min-h-[600px]">
              {renderContent()}
            </div>
          </main>
        </div>

        <footer className="mt-8 text-center text-sm text-slate-500">
           For demo only — replace mock services with real YouTube Data API, Gemini, and a backend for video processing.
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;

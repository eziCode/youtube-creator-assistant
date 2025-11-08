import React, { useState } from "react";
import { Tab, Tone, Video } from './types';
import { MOCK_VIDEOS } from './constants';
import Sidebar from './components/Sidebar';
import AnalyticsTab from './components/AnalyticsTab';
import CommentsTab from './components/CommentsTab';
import ShortsGeneratorTab from './components/ShortsGeneratorTab';
import SettingsTab from './components/SettingsTab';

const App: React.FC = () => {
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

export default App;

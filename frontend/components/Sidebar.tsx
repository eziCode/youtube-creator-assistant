import React from 'react';
import { Tab, Video } from '../types';
import { ChartBarIcon, MessageCircleIcon, FilmIcon, SettingsIcon } from './icons';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedVideo: Video | null;
  setSelectedVideo: (video: Video | null) => void;
  videos: Video[];
  isLoading: boolean;
  error: string | null;
}

const navItems = [
  { id: 'analytics', label: 'Analytics & Insights', icon: <ChartBarIcon /> },
  { id: 'comments', label: 'Comments & Replies', icon: <MessageCircleIcon /> },
  { id: 'shorts', label: 'Shorts Generator', icon: <FilmIcon /> },
  { id: 'videoIdeas', label: 'Video Ideas Generator', icon: <FilmIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedVideo,
  setSelectedVideo,
  videos,
  isLoading,
  error,
}) => {
  const handleVideoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const video = videos.find(v => v.id === e.target.value);
    setSelectedVideo(video ?? null);
  };

  const selectedVideoId = selectedVideo?.id ?? '';

  return (
    <aside className="col-span-12 md:col-span-3 bg-white rounded-xl p-4 shadow-sm h-fit md:sticky md:top-6">
      <h2 className="text-lg font-bold text-slate-800 px-2 mb-4">Dashboard</h2>
      <nav className="flex flex-col gap-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={`flex items-center text-left p-2 rounded-md transition-colors duration-200 text-sm font-medium ${activeTab === item.id
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <label htmlFor="video-select" className="block text-sm font-medium text-slate-600 px-2 mb-2">
          Selected Video
        </label>
        <select
          id="video-select"
          value={selectedVideoId}
          onChange={handleVideoChange}
          className="w-full mt-1 border-slate-300 rounded-md p-2 bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          disabled={isLoading || videos.length === 0}
        >
          {videos.length === 0 ? (
            <option value="" disabled>
              {isLoading ? 'Loading videos…' : 'No videos available'}
            </option>
          ) : (
            videos.map(v => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))
          )}
        </select>
        {isLoading && (
          <p className="mt-2 text-xs text-slate-500 px-2">Loading videos from YouTube…</p>
        )}
        {error && !isLoading && (
          <p className="mt-2 text-xs text-rose-600 px-2">Unable to load videos: {error}</p>
        )}
      </div>

      <div className="mt-6 text-xs text-slate-400 px-2">
        Videos are fetched from your YouTube channel when available.
      </div>
    </aside>
  );
};

export default Sidebar;

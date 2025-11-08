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
    <aside className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_70px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:sticky lg:top-10">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/50 px-1">
          Control Center
        </p>
        <h2 className="text-xl font-semibold text-white px-1">Workflow routes</h2>
      </div>

      <nav className="flex flex-col gap-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`group relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white/90 ${
                isActive ? 'border-white/30 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-rose-500/20 text-white' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 shadow-inner shadow-white/10 transition duration-300 group-hover:border-white/20 group-hover:text-white ${
                    isActive ? 'border-white/40 bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-rose-500/40 text-white' : ''
                  }`}
                >
                  <span className="h-5 w-5 text-inherit [&>*]:h-full [&>*]:w-full [&>*]:text-current">{item.icon}</span>
                </span>
                <span className="relative z-10 leading-tight">{item.label}</span>
              </span>
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold uppercase tracking-wide text-white/50 transition duration-300 group-hover:border-white/30 group-hover:text-white ${isActive ? 'border-white/60 bg-white/20 text-slate-900' : ''}`}
              >
                {item.id === 'analytics'
                  ? 'AI'
                  : item.id === 'comments'
                  ? 'CX'
                  : item.id === 'shorts'
                  ? 'SH'
                  : item.id === 'videoIdeas'
                  ? 'VI'
                  : 'SET'}
              </span>
              <span
                className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}`}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
              </span>
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-white/10">
        <div className="flex items-center justify-between">
          <label htmlFor="video-select" className="text-sm font-semibold text-white/80 uppercase tracking-[0.2em]">
            Selected Video
          </label>
          <span className="text-[10px] uppercase text-white/40">
            Live sync
          </span>
        </div>
        <div className="mt-3">
          <select
            id="video-select"
            value={selectedVideoId}
            onChange={handleVideoChange}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 disabled:opacity-60"
            disabled={isLoading || videos.length === 0}
          >
            {videos.length === 0 ? (
              <option value="" disabled>
                {isLoading ? 'Loading videos…' : 'No videos available'}
              </option>
            ) : (
              videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))
            )}
          </select>
        </div>
        {isLoading && (
          <p className="mt-3 text-xs text-white/50">Loading videos from YouTube…</p>
        )}
        {error && !isLoading && (
          <p className="mt-3 text-xs text-rose-300">Unable to load videos: {error}</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/50 shadow-inner shadow-white/10">
        Videos are fetched directly from your connected YouTube channel. Swap between them any time to update insights.
      </div>
    </aside>
  );
};

export default Sidebar;

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
    <aside className="flex w-full flex-col gap-10 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:sticky lg:top-10">
      <div className="space-y-4">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/50">
          Control Center
        </p>
        <h2 className="px-1 text-2xl font-semibold text-white">Workflow routes</h2>
      </div>

      <nav className="flex flex-col gap-4">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`group relative flex items-center justify-between gap-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-left text-[15px] font-semibold text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white/90 ${
                isActive ? 'border-white/30 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-rose-500/20 text-white' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-4">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 shadow-inner shadow-white/10 transition duration-300 group-hover:border-white/20 group-hover:text-white ${
                    isActive ? 'border-white/40 bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-rose-500/40 text-white' : ''
                  }`}
                >
                  <span className="h-5 w-5 text-inherit [&>*]:h-full [&>*]:w-full [&>*]:text-current">{item.icon}</span>
                </span>
                <span className="relative z-10 max-w-[160px] leading-snug text-white/80 group-hover:text-white">
                  {item.label}
                </span>
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-white/10">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="video-select" className="text-sm font-semibold text-white/80 uppercase tracking-[0.2em]">
            Selected Video
          </label>
          <span className="text-[10px] uppercase text-white/40">
            Live sync
          </span>
        </div>
        <div className="mt-4">
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-xs text-white/60 shadow-inner shadow-white/10">
        Videos are fetched directly from your connected YouTube channel. Swap between them any time to update insights.
      </div>
    </aside>
  );
};

export default Sidebar;

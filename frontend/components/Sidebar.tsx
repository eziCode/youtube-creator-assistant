import React, { useEffect, useMemo, useState } from 'react';
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
  isLoadingMore?: boolean;
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
  searchTerm?: string;
  onLoadMoreVideos?: () => void;
  hasMoreVideos?: boolean;
  isDemoMode?: boolean;
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
  isLoadingMore,
  onSearch,
  onClearSearch,
  searchTerm,
  onLoadMoreVideos,
  hasMoreVideos,
  isDemoMode,
}) => {
  const [searchInput, setSearchInput] = useState(searchTerm ?? '');

  useEffect(() => {
    setSearchInput(searchTerm ?? '');
  }, [searchTerm]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    []
  );

  const formatCompactNumber = (value?: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return numberFormatter.format(value);
  };

  const formatPublishedDate = (iso?: string | null) => {
    if (!iso) return null;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    onClearSearch?.();
  };

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
  };

  const selectedVideoId = selectedVideo?.id ?? null;
  const isSearching = Boolean(searchTerm && searchTerm.length > 0);
  const searchPlaceholder = isDemoMode
    ? 'Search Outdoor Boys videos'
    : 'Filter videos by title';

  const showEmptyState = !isLoading && videos.length === 0;

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
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            Video Library
          </h3>
          <span className="text-[10px] uppercase text-white/40">
            Live sync
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
          <button
            type="submit"
            className="rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_12px_30px_rgba(99,102,241,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(99,102,241,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Search
          </button>
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 shadow-inner shadow-white/10 transition hover:border-white/40 hover:text-white"
            >
              Clear
            </button>
          )}
        </form>
        <p className="mt-2 text-xs text-white/60">
          {isDemoMode
            ? 'Search taps directly into Outdoor Boys’ public catalog so judges can jump to any video instantly.'
            : 'Filter the loaded videos to quickly focus on a title you want to analyze.'}
        </p>

        <div className="mt-5 space-y-4">
          <div className="max-h-72 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/5"
                  />
                ))}
              </div>
            ) : showEmptyState ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60 shadow-inner shadow-white/5">
                {isSearching
                  ? 'No videos match your search yet. Try a different keyword.'
                  : 'Videos will appear here once we fetch them from YouTube.'}
              </div>
            ) : (
              <div className="space-y-3">
                {videos.map((video) => {
                  const isSelected = video.id === selectedVideoId;
                  const publishedLabel = formatPublishedDate(video.publishedAt);
                  const viewsLabel = formatCompactNumber(video.viewCount);

                  return (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => handleVideoSelect(video)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-indigo-400/50 bg-indigo-500/20 text-white shadow-[0_12px_25px_rgba(79,70,229,0.35)]'
                          : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <p className="truncate text-sm font-semibold">{video.title ?? 'Untitled video'}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
                        <span>{publishedLabel ?? 'Date unknown'}</span>
                        {viewsLabel && <span>{viewsLabel} views</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasMoreVideos && (
            <button
              type="button"
              onClick={onLoadMoreVideos}
              disabled={isLoadingMore}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 shadow-inner shadow-white/10 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? 'Loading more…' : 'Load more videos'}
            </button>
          )}

          {error && !isLoading && (
            <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 shadow-inner shadow-rose-500/20">
              Unable to load videos: {error}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-xs text-white/60 shadow-inner shadow-white/10">
        {isDemoMode
          ? 'You are browsing the Outdoor Boys channel. Choose any upload to preview how analytics, comments, and shorts spring to life for a top-tier creator.'
          : 'Videos are fetched directly from your connected YouTube channel. Pick one to refresh analytics, comment insights, and shorts suggestions.'}
      </div>
    </aside>
  );
};

export default Sidebar;

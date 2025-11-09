import React, { useEffect, useMemo, useState } from 'react';
import { Video } from '../types';

type SortKey = 'views' | 'likes' | 'alphabetical';
type SortDirection = 'asc' | 'desc';

interface VideoLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: Video[];
  selectedVideoId: string | null;
  onSelectVideo: (video: Video) => void;
  searchTerm: string;
  onSearch: (term: string) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onChangeSortKey: (key: SortKey) => void;
  onToggleSortDirection: () => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  views: 'Views',
  likes: 'Likes',
  alphabetical: 'Alphabetical',
};

const getThumbnailUrl = (video: Video) => {
  const thumbnails = video.thumbnails ?? {};
  const preferredOrder = ['maxres', 'standard', 'high', 'medium', 'default'];
  for (const key of preferredOrder) {
    const thumb = thumbnails[key];
    if (thumb?.url) {
      return thumb.url;
    }
  }
  const fallback = Object.values(thumbnails).find((thumb) => thumb?.url);
  return fallback?.url ?? null;
};

const formatDate = (iso?: string | null) => {
  if (!iso) return 'Date unknown';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Date unknown';
  return parsed.toLocaleDateString();
};

const formatCompact = (value?: number | null, fallback = '—') => {
  if (!Number.isFinite(value ?? null)) return fallback;
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value as number);
};

const VideoLibraryModal: React.FC<VideoLibraryModalProps> = ({
  isOpen,
  onClose,
  videos,
  selectedVideoId,
  onSelectVideo,
  searchTerm,
  onSearch,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  sortKey,
  sortDirection,
  onChangeSortKey,
  onToggleSortDirection,
}) => {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(() => {
      if (localSearch !== searchTerm) {
        onSearch(localSearch);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
    };
  }, [localSearch, searchTerm, onSearch, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_45px_120px_rgba(8,12,24,0.7)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
              Video Browser
            </p>
            <h2 className="text-2xl font-semibold text-white">Find the perfect MKBHD upload</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label
                htmlFor="video-library-search"
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
              >
                Search
              </label>
              <input
                id="video-library-search"
                type="search"
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Filter by title, topic, or keyword"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label
                  htmlFor="video-sort-key"
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
                >
                  Sort
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="video-sort-key"
                    value={sortKey}
                    onChange={(event) => onChangeSortKey(event.target.value as SortKey)}
                    className="rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  >
                    {Object.entries(SORT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onToggleSortDirection}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 shadow-inner shadow-white/10 transition hover:border-white/30 hover:text-white"
                    aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <span className="text-lg leading-none">
                      {sortDirection === 'asc' ? '▲' : '▼'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`video-skeleton-${index}`}
                  className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
              No videos match this search yet. Try another keyword.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {videos.map((video) => {
                const thumbnail = getThumbnailUrl(video);
                const isSelected = video.id === selectedVideoId;
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => {
                      onSelectVideo(video);
                      onClose();
                    }}
                    className={`flex items-center gap-4 rounded-3xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-indigo-400/70 bg-indigo-500/20 text-white shadow-[0_18px_40px_rgba(99,102,241,0.35)]'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={video.title ?? 'Video thumbnail'}
                        className="h-20 w-32 flex-shrink-0 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs text-white/50">
                        No thumbnail
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-white">
                        {video.title ?? 'Untitled video'}
                      </h3>
                      <p className="mt-1 text-xs text-white/60">{formatDate(video.publishedAt)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/50">
                        <span>{formatCompact(video.viewCount, '— views')} views</span>
                        <span>{formatCompact(video.likeCount, '— likes')} likes</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-6 py-4">
          <div className="text-xs text-white/60">
            {videos.length > 0
              ? `Showing ${videos.length.toLocaleString()} video${videos.length === 1 ? '' : 's'}.`
              : 'No videos loaded yet.'}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export type { SortKey, SortDirection };
export default VideoLibraryModal;



import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthenticatedUser, ChannelAnalyticsOverview, Tab, Tone, Video, VideoAnalyticsOverview } from '../types';
import { API_BASE_URL } from '../constants';
import Sidebar from './Sidebar';
import AnalyticsTab from './AnalyticsTab';
import CommentsTab from './CommentsTab';
import ShortsGeneratorTab from './ShortsGeneratorTab';
import SettingsTab from './SettingsTab';
import VideoIdeasGeneratorTab from "./VideoIdeasGeneratorTab";
import {
  fetchDemoVideos,
  fetchDemoChannelAnalytics,
  fetchDemoVideoAnalytics,
  fetchDemoChannel,
} from '../services/demoService';
import VideoLibraryModal, { SortDirection, SortKey } from './VideoLibraryModal';

const DEMO_CHANNEL_ID = 'UCfpCQ89W9wjkHc8J_6eTbBg';

interface DashboardProps {
  user: AuthenticatedUser | null;
  onLogout: () => void;
  isDemoMode?: boolean;
  demoChannel?: unknown;
  onUpdateDemoChannel?: (channel: unknown) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  user,
  onLogout,
  isDemoMode = false,
  demoChannel,
  onUpdateDemoChannel,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [tone, setTone] = useState<Tone>('Friendly');
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ChannelAnalyticsOverview | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [videoAnalytics, setVideoAnalytics] = useState<VideoAnalyticsOverview | null>(null);
  const [isLoadingVideoAnalytics, setIsLoadingVideoAnalytics] = useState<boolean>(false);
  const [videoAnalyticsError, setVideoAnalyticsError] = useState<string | null>(null);
  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<number>(28);
  const [useSampleData, setUseSampleData] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<string | undefined>(undefined);
  const [channelStartDate, setChannelStartDate] = useState<string | undefined>(undefined);
  const [videoSearchTerm, setVideoSearchTerm] = useState<string>('');
  const videoSearchTermRef = useRef<string>('');
  const [videoNextPageToken, setVideoNextPageToken] = useState<string | null>(null);
  const [isLoadingMoreVideos, setIsLoadingMoreVideos] = useState<boolean>(false);
  const videoFetchControllerRef = useRef<AbortController | null>(null);
  const [isVideoLibraryOpen, setIsVideoLibraryOpen] = useState(false);
  const [videoSortKey, setVideoSortKey] = useState<SortKey>('views');
  const [videoSortDirection, setVideoSortDirection] = useState<SortDirection>('desc');

  const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);
  const demoChannelTitle = useMemo(() => {
    if (!demoChannel || typeof demoChannel !== 'object') {
      return 'Outdoor Boys';
    }
    const maybeTitle = (demoChannel as { title?: unknown }).title;
    return typeof maybeTitle === 'string' && maybeTitle.length > 0 ? maybeTitle : 'Outdoor Boys';
  }, [demoChannel]);

  useEffect(() => {
    videoSearchTermRef.current = videoSearchTerm;
  }, [videoSearchTerm]);
  const toDateOnly = useCallback((iso?: string | null) => {
    if (!iso) return undefined;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return undefined;
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const activeChannelId = useMemo(
    () => (isDemoMode ? DEMO_CHANNEL_ID : user?.channelId ?? null),
    [isDemoMode, user?.channelId]
  );

  const loadVideos = useCallback(
    async ({
      reset = false,
      pageToken = null,
      searchOverride,
    }: {
      reset?: boolean;
      pageToken?: string | null;
      searchOverride?: string;
    } = {}) => {
      if (!activeChannelId) {
        return;
      }

      if (!isDemoMode && !reset) {
        return;
      }

      const controller = new AbortController();
      if (videoFetchControllerRef.current) {
        videoFetchControllerRef.current.abort();
      }
      videoFetchControllerRef.current = controller;

      if (reset) {
        setIsLoadingVideos(true);
        setVideoNextPageToken(null);
        setVideoError(null);
      } else {
        setIsLoadingMoreVideos(true);
      }

      try {
        let fetchedVideos: Video[] = [];
        let nextToken: string | null = null;

        if (isDemoMode) {
          const searchTerm =
            typeof searchOverride === 'string' ? searchOverride : videoSearchTermRef.current;
          const trimmedSearch = searchTerm.trim();
          const result = await fetchDemoVideos({
            pageSize: 25,
            source: trimmedSearch ? 'search' : 'uploads',
            query: trimmedSearch || undefined,
            pageToken: pageToken ?? undefined,
            signal: controller.signal,
          });

          fetchedVideos = Array.isArray(result?.videos) ? result.videos : [];
          nextToken = result?.nextPageToken ?? null;
        } else {
          const url = new URL(`${apiBaseUrl}/dashboard/videos`);
          url.searchParams.set('channelId', activeChannelId);
          if (useSampleData) url.searchParams.set('useSample', '1');

          const response = await fetch(url.toString(), {
            credentials: 'include',
            signal: controller.signal,
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            const message =
              (payload &&
                typeof payload === 'object' &&
                'error' in payload &&
                typeof payload.error === 'string')
                ? payload.error
                : `Failed to load videos (status ${response.status})`;
            throw new Error(message);
          }

          fetchedVideos = Array.isArray(payload?.videos) ? payload.videos : [];
          nextToken = null;
        }

        if (controller.signal.aborted) {
          return;
        }

        let combinedVideos: Video[] = [];
        let computedStartDate: string | undefined;

        setVideos((prev) => {
          const base = reset ? [] : prev;
          const map = new Map<string, Video>();
          base.forEach((video) => {
            if (video?.id) {
              map.set(video.id, video);
            }
          });
          fetchedVideos.forEach((video) => {
            if (video?.id) {
              map.set(video.id, video);
            }
          });
          combinedVideos = Array.from(map.values());
          computedStartDate = combinedVideos.reduce<string | undefined>((earliest, video) => {
            const dateOnly = toDateOnly(video?.publishedAt);
            if (!dateOnly) return earliest;
            if (!earliest || dateOnly < earliest) {
              return dateOnly;
            }
            return earliest;
          }, undefined);
          return combinedVideos;
        });

        if (controller.signal.aborted) {
          return;
        }

        setChannelStartDate(computedStartDate);
        setSelectedVideo((prev) => {
          if (!combinedVideos.length) {
            return null;
          }
          if (prev) {
            const existing = combinedVideos.find((video) => video.id === prev.id);
            if (existing) {
              return existing;
            }
          }
          return combinedVideos[0];
        });
        setVideoNextPageToken(isDemoMode ? nextToken : null);
        setVideoError(null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[dashboard] failed to load videos', err);
        if (reset) {
          setVideos([]);
          setSelectedVideo(null);
          setChannelStartDate(undefined);
        }
        setVideoError(err instanceof Error ? err.message : 'Failed to load videos');
        setVideoNextPageToken(null);
      } finally {
        if (!controller.signal.aborted) {
          if (reset) {
            setIsLoadingVideos(false);
          } else {
            setIsLoadingMoreVideos(false);
          }
        }

        if (videoFetchControllerRef.current === controller) {
          videoFetchControllerRef.current = null;
        }
      }
    },
    [activeChannelId, apiBaseUrl, isDemoMode, toDateOnly, useSampleData]
  );

  const filteredVideos = useMemo(() => {
    if (!isDemoMode) {
      const term = videoSearchTerm.trim().toLowerCase();
      if (!term) {
        return videos;
      }
      return videos.filter((video) =>
        (video.title ?? '').toLowerCase().includes(term)
      );
    }
    return videos;
  }, [videos, isDemoMode, videoSearchTerm]);

  const displayedVideos = useMemo(() => {
    const term = videoSearchTerm.trim().toLowerCase();
    const hasSearch = term.length > 0;

    if (hasSearch) {
      if (isDemoMode) {
        return filteredVideos;
      }

      const withScores = [...filteredVideos].map((video) => {
        const title = (video.title ?? '').toLowerCase();
        const index = title.indexOf(term);
        const startsWith = index === 0 ? 0 : index > 0 ? 1 : 2;
        const score = index >= 0 ? index : Number.POSITIVE_INFINITY;
        return { video, startsWith, score, title };
      });

      withScores.sort((a, b) => {
        if (a.startsWith !== b.startsWith) {
          return a.startsWith - b.startsWith;
        }
        if (a.score !== b.score) {
          return a.score - b.score;
        }
        return a.title.localeCompare(b.title);
      });

      return withScores.map((entry) => entry.video);
    }

    const list = [...filteredVideos];
    const compare = (a: Video, b: Video) => {
      switch (videoSortKey) {
        case 'alphabetical': {
          const titleA = (a.title ?? '').toLowerCase();
          const titleB = (b.title ?? '').toLowerCase();
          return titleA.localeCompare(titleB);
        }
        case 'likes': {
          const likesA = Number.isFinite(a.likeCount) ? (a.likeCount as number) : -Infinity;
          const likesB = Number.isFinite(b.likeCount) ? (b.likeCount as number) : -Infinity;
          return likesA - likesB;
        }
        case 'views':
        default: {
          const viewsA = Number.isFinite(a.viewCount) ? (a.viewCount as number) : -Infinity;
          const viewsB = Number.isFinite(b.viewCount) ? (b.viewCount as number) : -Infinity;
          return viewsA - viewsB;
        }
      }
    };
    list.sort(compare);
    if (videoSortDirection === 'desc') {
      list.reverse();
    }
    return list;
  }, [filteredVideos, videoSearchTerm, isDemoMode, videoSortKey, videoSortDirection]);

  useEffect(() => {
    if (!isDemoMode || typeof onUpdateDemoChannel !== 'function') {
      return;
    }

    let cancelled = false;

    const loadDemoChannel = async () => {
      try {
        const payload = await fetchDemoChannel();
        if (!cancelled) {
          onUpdateDemoChannel(payload?.channel ?? null);
        }
      } catch (error) {
        console.error('[dashboard] failed to load demo channel profile', error);
      }
    };

    loadDemoChannel();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, onUpdateDemoChannel]);

  useEffect(() => {
    return () => {
      videoFetchControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setSelectedVideo((prev) => {
      if (!displayedVideos.length) {
        return null;
      }
      if (prev) {
        const existing = displayedVideos.find((video) => video.id === prev.id);
        if (existing) {
          return existing;
        }
      }
      return displayedVideos[0];
    });
  }, [displayedVideos]);

  useEffect(() => {
    if (!activeChannelId) {
      setVideos([]);
      setSelectedVideo(null);
      setIsLoadingVideos(false);
      setIsLoadingMoreVideos(false);
      setVideoNextPageToken(null);
      setVideoError(
        isDemoMode
          ? 'Demo channel unavailable. Please retry demo mode.'
          : user
          ? 'No YouTube channel connected to this account yet.'
          : null
      );
      setAnalytics(null);
      setIsLoadingAnalytics(false);
      setAnalyticsError(
        isDemoMode
          ? 'Demo analytics unavailable until the session is refreshed.'
          : user
          ? 'No analytics available until a channel is connected.'
          : null
      );
      setVideoAnalytics(null);
      setIsLoadingVideoAnalytics(false);
      setVideoAnalyticsError(
        isDemoMode
          ? 'Demo video insights unavailable.'
          : user
          ? 'Select a channel video to analyze once connected.'
          : null
      );
      setChannelStartDate(undefined);
      return;
    }

    void loadVideos({ reset: true });
  }, [activeChannelId, isDemoMode, loadVideos, user, useSampleData]);

  const handleVideoSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      setVideoSearchTerm(trimmed);
      if (isDemoMode) {
        void loadVideos({ reset: true, searchOverride: trimmed });
      }
    },
    [isDemoMode, loadVideos]
  );

  const handleLoadMoreVideos = useCallback(() => {
    if (!videoNextPageToken) {
      return;
    }
    void loadVideos({ pageToken: videoNextPageToken });
  }, [loadVideos, videoNextPageToken]);

  const handleOpenVideoLibrary = useCallback(() => {
    setIsVideoLibraryOpen(true);
  }, []);

  const handleCloseVideoLibrary = useCallback(() => {
    setIsVideoLibraryOpen(false);
  }, []);

  const handleChangeSortKey = useCallback((key: SortKey) => {
    setVideoSortKey(key);
  }, []);

  const handleToggleSortDirection = useCallback(() => {
    setVideoSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  useEffect(() => {
    if (!activeChannelId) {
      setAnalytics(null);
      setIsLoadingAnalytics(false);
      return;
    }

    const isCustomRange = analyticsRangeDays === 0;

    if (isCustomRange && (!customStartDate || !customEndDate)) {
      setAnalytics(null);
      return;
    }

    const controller = new AbortController();

    const computeRangeFromCustom = () => {
      if (!customStartDate || !customEndDate) return undefined;
      const start = new Date(`${customStartDate}T00:00:00Z`);
      const end = new Date(`${customEndDate}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return undefined;
      }
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      return diffDays > 0 ? diffDays : undefined;
    };

    const requestedRangeDays = isCustomRange
      ? computeRangeFromCustom() ?? analyticsRangeDays
      : analyticsRangeDays;

    const fetchAnalytics = async () => {
      setIsLoadingAnalytics(true);
      setAnalyticsError(null);

      try {
        if (isDemoMode) {
          const result = await fetchDemoChannelAnalytics(requestedRangeDays, controller.signal);
          setAnalytics(result?.analytics ?? null);
          return;
        }

        const params = new URLSearchParams();
        if (isCustomRange && customStartDate && customEndDate) {
          params.set('startDate', customStartDate);
          params.set('endDate', customEndDate);
        } else {
          params.set('rangeDays', String(analyticsRangeDays));
        }
        const response = await fetch(`${apiBaseUrl}/dashboard/analytics/overview?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
              ? payload.error
              : `Failed to load analytics (status ${response.status})`;
          throw new Error(message);
        }

        setAnalytics(payload?.analytics ?? null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[dashboard] failed to load analytics', err);
        setAnalytics(null);
        setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAnalytics(false);
        }
      }
    };

    fetchAnalytics();

    return () => {
      controller.abort();
    };
  }, [
    apiBaseUrl,
    activeChannelId,
    isDemoMode,
    analyticsRangeDays,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    if (!selectedVideo?.id || !activeChannelId) {
      setVideoAnalytics(null);
      setIsLoadingVideoAnalytics(false);
      setVideoAnalyticsError(
        isDemoMode
          ? 'Select a video from the Outdoor Boys library to view demo analytics.'
          : user?.channelId
          ? 'Select a video to explore detailed analytics.'
          : 'Connect a channel to analyze individual videos.'
      );
      return;
    }

    const isCustomRange = analyticsRangeDays === 0;
    if (isCustomRange && (!customStartDate || !customEndDate)) {
      return;
    }

    const controller = new AbortController();

    const computeRangeFromCustom = () => {
      if (!customStartDate || !customEndDate) return undefined;
      const start = new Date(`${customStartDate}T00:00:00Z`);
      const end = new Date(`${customEndDate}T00:00:00Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return undefined;
      }
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      return diffDays > 0 ? diffDays : undefined;
    };

    const requestedRangeDays = isCustomRange
      ? computeRangeFromCustom() ?? analyticsRangeDays
      : analyticsRangeDays;

    const fetchVideoAnalytics = async () => {
      setIsLoadingVideoAnalytics(true);
      setVideoAnalyticsError(null);

      try {
        if (isDemoMode) {
          const result = await fetchDemoVideoAnalytics(
            selectedVideo.id,
            requestedRangeDays,
            controller.signal
          );
          setVideoAnalytics(result?.analytics ?? null);
          return;
        }

        const params = new URLSearchParams({
          videoId: selectedVideo.id,
        });

        if (isCustomRange && customStartDate && customEndDate) {
          params.set('startDate', customStartDate);
          params.set('endDate', customEndDate);
        } else {
          params.set('rangeDays', String(analyticsRangeDays));
        }
        const response = await fetch(`${apiBaseUrl}/dashboard/analytics/video?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
              ? payload.error
              : `Failed to load video analytics (status ${response.status})`;
          throw new Error(message);
        }

        setVideoAnalytics(payload?.analytics ?? null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[dashboard] failed to load video analytics', err);
        setVideoAnalytics(null);
        setVideoAnalyticsError(err instanceof Error ? err.message : 'Failed to load video analytics');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingVideoAnalytics(false);
        }
      }
    };

    fetchVideoAnalytics();

    return () => {
      controller.abort();
    };
  }, [
    apiBaseUrl,
    activeChannelId,
    isDemoMode,
    selectedVideo?.id,
    analyticsRangeDays,
    customStartDate,
    customEndDate,
  ]);

  const handleChangeRangeDays = useCallback((days: number) => {
    setAnalyticsRangeDays(days);
    if (days > 0) {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  }, []);

  const handleChangeCustomDateRange = useCallback((start: string, end: string) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <AnalyticsTab
            videos={displayedVideos}
            analytics={analytics}
            selectedVideo={selectedVideo}
            videoAnalytics={videoAnalytics}
            isLoadingVideos={isLoadingVideos}
            isLoadingAnalytics={isLoadingAnalytics}
            isLoadingVideoAnalytics={isLoadingVideoAnalytics}
            videoError={videoError}
            analyticsError={analyticsError}
            videoAnalyticsError={videoAnalyticsError}
            analyticsRangeDays={analyticsRangeDays}
            onChangeRangeDays={handleChangeRangeDays}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onChangeCustomDateRange={handleChangeCustomDateRange}
            channelStartDate={channelStartDate}
            isDemoMode={isDemoMode}
            demoChannelTitle={demoChannelTitle}
          />
        );
      case 'comments':
        return (
          <CommentsTab
            tone={tone}
            selectedVideo={selectedVideo}
            user={user}
            isDemoMode={isDemoMode}
            demoChannelTitle={demoChannelTitle}
          />
        );
      case 'shorts':
        return <ShortsGeneratorTab selectedVideo={selectedVideo} isDemoMode={isDemoMode} />;
      case 'settings':
        return <SettingsTab tone={tone} setTone={setTone} />;
      case 'videoIdeas':
        return <VideoIdeasGeneratorTab userChannelId={user?.channelId ?? null} useSample={useSampleData} />;
      default:
        return <div>Select a tab</div>;

    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[640px] w-[640px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[min(96vw,1800px)] flex-col gap-10 px-5 py-10 sm:px-8 lg:px-14 xl:px-16">
        <header className="relative z-10 flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Creator Command Center
            </p>
            <h1 className="text-3xl font-semibold text-white drop-shadow-sm">
              YouTube AI Assistant
            </h1>
            <p className="text-sm text-white/60">
              Track performance, nurture your community, and spin up new content without leaving this workspace.
            </p>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            {user && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-white/10">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name ?? user.email}
                    className="h-11 w-11 rounded-full border border-white/20 object-cover shadow-lg shadow-indigo-500/20"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/20 text-lg font-semibold text-indigo-200 shadow-inner shadow-indigo-500/20">
                    {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-sm">
                  <p className="font-semibold text-white/90 leading-tight">
                    {user.name ?? user.email}
                  </p>
                  {user.email && (
                    <p className="text-white/60">{user.email}</p>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_22px_40px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_60px_rgba(99,102,241,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:gap-10">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            videos={displayedVideos}
            isLoading={isLoadingVideos}
            error={videoError}
            isDemoMode={isDemoMode}
            onOpenVideoBrowser={handleOpenVideoLibrary}
          />

          <main>
            <div className="min-h-[640px] rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:p-7 lg:p-10">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
      <VideoLibraryModal
        isOpen={isVideoLibraryOpen}
        onClose={handleCloseVideoLibrary}
        videos={displayedVideos}
        selectedVideoId={selectedVideo?.id ?? null}
        onSelectVideo={(video) => setSelectedVideo(video)}
        searchTerm={videoSearchTerm}
        onSearch={handleVideoSearch}
        isLoading={isLoadingVideos && !isLoadingMoreVideos}
        isLoadingMore={isLoadingMoreVideos}
        hasMore={Boolean(videoNextPageToken)}
        onLoadMore={handleLoadMoreVideos}
        sortKey={videoSortKey}
        sortDirection={videoSortDirection}
        onChangeSortKey={handleChangeSortKey}
        onToggleSortDirection={handleToggleSortDirection}
      />
    </div>
  );
};

export default Dashboard;

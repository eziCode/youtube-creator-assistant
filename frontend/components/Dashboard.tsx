import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AuthenticatedUser, ChannelAnalyticsOverview, Tab, Tone, Video, VideoAnalyticsOverview } from '../types';
import { API_BASE_URL } from '../constants';
import Sidebar from './Sidebar';
import AnalyticsTab from './AnalyticsTab';
import CommentsTab from './CommentsTab';
import ShortsGeneratorTab from './ShortsGeneratorTab';
import SettingsTab from './SettingsTab';
import VideoIdeasGeneratorTab from "./VideoIdeasGeneratorTab";

interface DashboardProps {
  user: AuthenticatedUser | null;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
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

  const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);
  const toDateOnly = useCallback((iso?: string | null) => {
    if (!iso) return undefined;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return undefined;
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    if (!user?.channelId) {
      setVideos([]);
      setSelectedVideo(null);
      setIsLoadingVideos(false);
      setVideoError(user ? 'No YouTube channel connected to this account yet.' : null);
      setAnalytics(null);
      setIsLoadingAnalytics(false);
      setAnalyticsError(user ? 'No analytics available until a channel is connected.' : null);
      setVideoAnalytics(null);
      setIsLoadingVideoAnalytics(false);
      setVideoAnalyticsError(user ? 'Select a channel video to analyze once connected.' : null);
      setChannelStartDate(undefined);
      return;
    }

    const controller = new AbortController();

    const fetchVideos = async () => {
      setIsLoadingVideos(true);
      setVideoError(null);

      try {
        const url = new URL(`${apiBaseUrl}/dashboard/videos`);
        url.searchParams.set('channelId', user.channelId);
        if (useSampleData) url.searchParams.set('useSample', '1');

        const response = await fetch(url.toString(), {
          credentials: 'include',
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
              ? payload.error
              : `Failed to load videos (status ${response.status})`;
          throw new Error(message);
        }

        const fetchedVideos: Video[] = Array.isArray(payload?.videos) ? payload.videos : [];
        setVideos(fetchedVideos);
        const earliestPublished = fetchedVideos.reduce<string | undefined>((earliest, video) => {
          const dateOnly = toDateOnly(video?.publishedAt);
          if (!dateOnly) return earliest;
          if (!earliest || dateOnly < earliest) {
            return dateOnly;
          }
          return earliest;
        }, undefined);
        setChannelStartDate(earliestPublished);
        setSelectedVideo((prev) => {
          if (!fetchedVideos.length) {
            return null;
          }
          if (prev) {
            const existing = fetchedVideos.find((video) => video.id === prev.id);
            if (existing) {
              return existing;
            }
          }
          return fetchedVideos[0];
        });
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[dashboard] failed to load videos', err);
        setVideos([]);
        setSelectedVideo(null);
        setVideoError(err instanceof Error ? err.message : 'Failed to load videos');
        setChannelStartDate(undefined);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingVideos(false);
        }
      }
    };

    fetchVideos();

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, user?.channelId, useSampleData]);

  useEffect(() => {
    if (!user?.channelId) {
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

    const fetchAnalytics = async () => {
      setIsLoadingAnalytics(true);
      setAnalyticsError(null);

      try {
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
  }, [apiBaseUrl, user?.channelId, analyticsRangeDays, customStartDate, customEndDate]);

  useEffect(() => {
    if (!user?.channelId || !selectedVideo?.id) {
      setVideoAnalytics(null);
      setIsLoadingVideoAnalytics(false);
      setVideoAnalyticsError(
        user?.channelId
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

    const fetchVideoAnalytics = async () => {
      setIsLoadingVideoAnalytics(true);
      setVideoAnalyticsError(null);

      try {
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
  }, [apiBaseUrl, user?.channelId, selectedVideo?.id, analyticsRangeDays, customStartDate, customEndDate]);

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
            videos={videos}
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
          />
        );
      case 'comments':
        return <CommentsTab tone={tone} />;
      case 'shorts':
        return <ShortsGeneratorTab selectedVideo={selectedVideo} />;
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

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-10 sm:px-8 lg:px-10">
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

        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            videos={videos}
            isLoading={isLoadingVideos}
            error={videoError}
          />

          <main className="col-span-12 lg:col-span-8 xl:col-span-9">
            <div className="min-h-[640px] rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.55)] backdrop-blur-2xl lg:p-8">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useEffect, useMemo, useState } from "react";
import { AuthenticatedUser, ChannelAnalyticsOverview, Tab, Tone, Video, VideoAnalyticsOverview } from '../types';
import { API_BASE_URL } from '../constants';
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

  const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

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
      return;
    }

    const controller = new AbortController();

    const fetchVideos = async () => {
      setIsLoadingVideos(true);
      setVideoError(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/dashboard/videos?channelId=${encodeURIComponent(user.channelId)}`,
          {
            credentials: 'include',
            signal: controller.signal,
          }
        );

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
  }, [apiBaseUrl, user?.channelId]);

  useEffect(() => {
    if (!user?.channelId) {
      setAnalytics(null);
      setIsLoadingAnalytics(false);
      return;
    }

    const controller = new AbortController();

    const fetchAnalytics = async () => {
      setIsLoadingAnalytics(true);
      setAnalyticsError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/dashboard/analytics/overview`, {
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
  }, [apiBaseUrl, user?.channelId]);

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

    const controller = new AbortController();

    const fetchVideoAnalytics = async () => {
      setIsLoadingVideoAnalytics(true);
      setVideoAnalyticsError(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/dashboard/analytics/video?videoId=${encodeURIComponent(selectedVideo.id)}`,
          {
            credentials: 'include',
            signal: controller.signal,
          }
        );

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
  }, [apiBaseUrl, user?.channelId, selectedVideo?.id]);

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
          />
        );
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

        <div className="grid grid-cols-12 gap-8">
          <Sidebar 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            videos={videos}
            isLoading={isLoadingVideos}
            error={videoError}
          />

          <main className="col-span-12 md:col-span-9">
            <div className="bg-slate-50 rounded-2xl p-6 shadow-sm min-h-[620px]">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

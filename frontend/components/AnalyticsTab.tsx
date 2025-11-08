import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChannelAnalyticsOverview, Video, VideoAnalyticsOverview } from '../types';
import Card from './Card';

interface AnalyticsTabProps {
  videos: Video[];
  selectedVideo: Video | null;
  analytics: ChannelAnalyticsOverview | null;
  videoAnalytics: VideoAnalyticsOverview | null;
  isLoadingVideos: boolean;
  isLoadingAnalytics: boolean;
  isLoadingVideoAnalytics: boolean;
  videoError: string | null;
  analyticsError: string | null;
  videoAnalyticsError: string | null;
  analyticsRangeDays: number;
  onChangeRangeDays: (days: number) => void;
}

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  Number.isFinite(value) ? value.toLocaleString(undefined, options) : '—';

const formatPercent = (ratio: number | null) => {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(Math.abs(ratio) < 0.1 ? 2 : 1)}%`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
};

const getDeltaBadgeClass = (delta: number | undefined) => {
  if (delta === undefined || delta === 0) return 'bg-slate-100 text-slate-600';
  return delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
};

const formatWatchTime = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';

  if (minutes < 60) {
    const roundedMinutes = Math.max(1, Math.round(minutes));
    return `${roundedMinutes} min${roundedMinutes === 1 ? '' : 's'}`;
  }

  const hours = minutes / 60;
  const precision = hours >= 10 ? 0 : 1;
  const normalizedHours =
    precision === 0 ? Math.round(hours) : Math.round(hours * 10) / 10;
  const formattedHours = formatNumber(normalizedHours, { maximumFractionDigits: precision });
  const unit = normalizedHours === 1 ? 'hr' : 'hrs';
  return `${formattedHours} ${unit}`;
};

const formatDateLabel = (date?: string) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  videos,
  selectedVideo,
  analytics,
  videoAnalytics,
  isLoadingVideos,
  isLoadingAnalytics,
  isLoadingVideoAnalytics,
  videoError,
  analyticsError,
  videoAnalyticsError,
  analyticsRangeDays,
  onChangeRangeDays,
}) => {
  const [viewMode, setViewMode] = useState<'channel' | 'video'>('channel');

  useEffect(() => {
    if (!selectedVideo && viewMode === 'video') {
      setViewMode('channel');
    }
  }, [selectedVideo, viewMode]);

  const isLoadingChannel = isLoadingVideos || isLoadingAnalytics;

  const totals = analytics?.totals;
  const dailySeries = analytics?.daily ?? [];
  const currentPeriod = analytics?.period.current;
  const previousPeriod = analytics?.period.previous;

  const channelHeroMetrics = useMemo(() => {
    if (!totals) return [];
    return [
      {
        label: 'Views',
        value: formatNumber(totals.views?.value ?? 0),
        delta: totals.views?.delta,
        deltaRatio: totals.views?.deltaRatio,
      },
      {
        label: 'Watch Time',
        value: formatWatchTime(totals.estimatedMinutesWatched?.value ?? 0),
        delta: totals.estimatedMinutesWatched?.delta,
        deltaRatio: totals.estimatedMinutesWatched?.deltaRatio,
      },
      {
        label: 'Net Subscribers',
        value: formatNumber(totals.netSubscribers?.value ?? 0, { signDisplay: 'always' }),
        delta: totals.netSubscribers?.delta,
        deltaRatio: totals.netSubscribers?.deltaRatio,
      },
    ];
  }, [totals]);

  const metricsConfig = useMemo(
    () => [
      {
        key: 'averageViewDuration',
        label: 'Avg View Duration',
        format: (value: number) => formatDuration(value),
      },
      {
        key: 'averageViewPercentage',
        label: 'Avg View %',
        format: (value: number) => `${value.toFixed(1)}%`,
      },
      {
        key: 'likes',
        label: 'Likes',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'comments',
        label: 'Comments',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'shares',
        label: 'Shares',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'subscribersGained',
        label: 'Subs Gained',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'subscribersLost',
        label: 'Subs Lost',
        format: (value: number) => formatNumber(value),
      },
    ],
    []
  );

  const peakDay = useMemo(() => {
    if (!dailySeries.length) return null;
    return dailySeries.reduce((best, entry) => {
      if (!best) return entry;
      return (entry.views ?? 0) > (best.views ?? 0) ? entry : best;
    }, dailySeries[0]);
  }, [dailySeries]);


  const hasAnalyticsData = Boolean(analytics && totals);
  const showEmptyState =
    !isLoadingChannel && !hasAnalyticsData && !analyticsError && !videoError;

  const highlightInsights = useMemo(() => {
    if (!totals) return [];
    const insights: Array<{ title: string; detail: string }> = [];

    if (totals.views) {
      insights.push({
        title: 'View Momentum',
        detail: `Views ${totals.views.delta >= 0 ? 'grew' : 'declined'} by ${formatPercent(
          totals.views.deltaRatio
        )} compared to the previous period.`,
      });
    }

    if (totals.averageViewDuration) {
      insights.push({
        title: 'Retention Health',
        detail: `Average viewers stayed for ${formatDuration(
          totals.averageViewDuration.value
        )}, a change of ${formatPercent(totals.averageViewDuration.deltaRatio)}.`,
      });
    }

    if (totals.netSubscribers) {
      insights.push({
        title: 'Subscriber Impact',
        detail: `Net subscribers ${totals.netSubscribers.delta >= 0 ? 'increased' : 'decreased'} by ${
          totals.netSubscribers.delta >= 0 ? '+' : ''
        }${formatNumber(totals.netSubscribers.delta)}.`,
      });
    }

    return insights;
  }, [totals]);

  const selectedVideoTotals = videoAnalytics?.totals;
  const videoDailySeries = videoAnalytics?.daily ?? [];
  const videoPeriod = videoAnalytics?.period?.current;
  const videoPreviousPeriod = videoAnalytics?.period?.previous;

  const videoHeroMetrics = useMemo(() => {
    if (!selectedVideoTotals) return [];
    return [
      {
        label: 'Views',
        value: formatNumber(selectedVideoTotals.views?.value ?? 0),
        delta: selectedVideoTotals.views?.delta,
        deltaRatio: selectedVideoTotals.views?.deltaRatio,
      },
      {
        label: 'Avg View Duration',
        value: formatDuration(selectedVideoTotals.averageViewDuration?.value ?? 0),
        delta: selectedVideoTotals.averageViewDuration?.delta,
        deltaRatio: selectedVideoTotals.averageViewDuration?.deltaRatio,
      },
      {
        label: 'Watch Time',
        value: formatWatchTime(selectedVideoTotals.estimatedMinutesWatched?.value ?? 0),
        delta: selectedVideoTotals.estimatedMinutesWatched?.delta,
        deltaRatio: selectedVideoTotals.estimatedMinutesWatched?.deltaRatio,
      },
    ];
  }, [selectedVideoTotals]);

  const bestThumbnail = useMemo(() => {
    const thumbnails = selectedVideo?.thumbnails;
    if (!thumbnails) return null;

    const values = Object.values(thumbnails ?? {}) as Array<
      { url?: string; width?: number; height?: number } | undefined
    >;

    const candidates = values
      .filter((thumb): thumb is { url?: string; width?: number; height?: number } => Boolean(thumb?.url))
      .map((thumb) => ({
        url: thumb?.url ?? '',
        width: thumb?.width ?? 0,
        height: thumb?.height ?? 0,
      }));

    if (!candidates.length) return null;

    return candidates.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  }, [selectedVideo?.thumbnails]);

  const videoWatchUrl = selectedVideo ? `https://www.youtube.com/watch?v=${selectedVideo.id}` : null;

  const videoMetricsConfig = useMemo(
    () => [
      {
        key: 'averageViewDuration',
        label: 'Avg View Duration',
        format: (value: number) => formatDuration(value),
      },
      {
        key: 'averageViewPercentage',
        label: 'Avg View %',
        format: (value: number) => `${value.toFixed(1)}%`,
      },
      {
        key: 'likes',
        label: 'Likes',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'comments',
        label: 'Comments',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'shares',
        label: 'Shares',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'netSubscribers',
        label: 'Net Subscribers',
        format: (value: number) => formatNumber(value, { signDisplay: 'always' }),
      },
    ],
    []
  );

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Analytics & Insights</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isLoadingChannel
              ? 'Syncing latest stats…'
              : hasAnalyticsData && currentPeriod
              ? `Reporting ${currentPeriod.startDate} → ${currentPeriod.endDate}`
              : `Tracking ${videos.length} video${videos.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
            {[7, 28, 90].map((days) => {
              const isActive = analyticsRangeDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChangeRangeDays(days)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                    isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  aria-pressed={isActive}
                >
                  Last {days}d
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
            {([
              { id: 'channel' as const, label: 'Channel' },
              { id: 'video' as const, label: 'Video' },
            ] as const).map((mode) => {
              const disabled = mode.id === 'video' && !selectedVideo;
              const isActive = !disabled && viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    setViewMode(mode.id);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                    isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-pressed={isActive}
                  disabled={disabled}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {viewMode === 'channel' && (analyticsError || videoError) && (
        <div className="p-4 border border-rose-200 bg-rose-50 text-rose-700 text-sm rounded-md">
          {analyticsError ?? videoError}
        </div>
      )}

      {viewMode === 'channel' && showEmptyState && (
        <div className="p-4 border border-slate-200 bg-slate-50 text-slate-600 text-sm rounded-md">
          We couldn&apos;t retrieve analytics for this channel yet. Try again after publishing new videos or reconnecting your YouTube account.
        </div>
      )}

      {viewMode === 'channel' && (
        <>
          <Card
            title="Channel Pulse"
            description={
              channelHeroMetrics.length
                ? 'Key movements across your channel for the selected window.'
                : undefined
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {isLoadingChannel && channelHeroMetrics.length === 0
                ? Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`channel-pulse-skeleton-${idx}`}
                      className="rounded-xl border border-slate-200 px-4 py-5 shadow-sm flex flex-col gap-3 bg-white"
                    >
                      <div className="skeleton skeleton-xs w-20 rounded-full" />
                      <div className="skeleton skeleton-xl w-24" />
                      <div className="flex items-center gap-2">
                        <div className="skeleton skeleton-chip w-20" />
                        <div className="skeleton skeleton-xs flex-1 rounded-full" />
                      </div>
                    </div>
                  ))
                : channelHeroMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-4 py-5 shadow-sm flex flex-col gap-3"
                    >
                      <div className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</div>
                      <div className="text-2xl font-semibold text-slate-900">{metric.value}</div>
                      <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span
                          className={`px-2 py-1 rounded-full ${
                            (metric.delta ?? 0) > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : (metric.delta ?? 0) < 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {metric.delta !== undefined && metric.delta !== null
                            ? `${metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'} ${formatPercent(
                                metric.deltaRatio
                              )}`
                            : '—'}
                        </span>
                        <span className="text-slate-500">vs previous</span>
                      </div>
                    </div>
                  ))}
              {channelHeroMetrics.length === 0 && !isLoadingChannel && (
                <div className="col-span-full text-sm text-slate-500">
                  No channel metrics available for this window.
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Channel Snapshot"
            description={
              previousPeriod
                ? `Comparing ${currentPeriod?.startDate} → ${currentPeriod?.endDate} against ${previousPeriod.startDate} → ${previousPeriod.endDate}`
                : undefined
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {metricsConfig.map(({ key, label, format }) => {
                const metric = totals?.[key];
                return (
                  <div key={key} className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                    {isLoadingChannel && !metric ? (
                      <div className="skeleton skeleton-lg w-24" />
                    ) : metric ? (
                      <>
                        <div className="text-2xl font-semibold text-slate-800">{format(metric.value)}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${getDeltaBadgeClass(
                              metric.delta
                            )}`}
                          >
                            {metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'}{' '}
                            {formatPercent(metric.deltaRatio)}
                          </span>
                          <span className="text-slate-500">vs previous</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No data available</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Engagement Highlights">
            {isLoadingChannel && highlightInsights.length === 0 ? (
              <div className="space-y-3">
                <div className="skeleton skeleton-sm w-48" />
                <div className="skeleton skeleton-sm w-56" />
                <div className="skeleton skeleton-sm w-40" />
              </div>
            ) : highlightInsights.length > 0 ? (
              <ul className="space-y-4 text-sm text-slate-600">
                {highlightInsights.map((insight) => (
                  <li key={insight.title}>
                    <p className="text-slate-800 font-semibold">{insight.title}</p>
                    <p className="mt-1">{insight.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Analytics insights will appear here once sufficient data is available.
              </p>
            )}
          </Card>
        </>
      )}

      {viewMode === 'video' && (
        <Card
          title="Selected Video Overview"
          description={
            selectedVideo
              ? videoPeriod
                ? `${selectedVideo.title} · ${videoPeriod.startDate} → ${videoPeriod.endDate}`
                : selectedVideo.title
              : 'Pick a published video from the sidebar to explore its performance.'
          }
        >
          {!selectedVideo ? (
            <p className="text-sm text-slate-500">Select a video from the sidebar to dive into specifics.</p>
          ) : videoAnalyticsError ? (
            <div className="p-4 border border-rose-200 bg-rose-50 text-rose-700 text-sm rounded-md">
              {videoAnalyticsError}
            </div>
          ) : isLoadingVideoAnalytics ? (
            <div className="space-y-4">
              <div className="skeleton skeleton-sm w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="skeleton skeleton-panel h-20 w-full" />
                ))}
              </div>
              <div className="skeleton skeleton-panel h-40 w-full" />
            </div>
          ) : !selectedVideoTotals ? (
            <p className="text-sm text-slate-500">
              We couldn&apos;t find analytics for this video during the selected period.
            </p>
          ) : (
            <div className="space-y-6">
              {bestThumbnail && (
                <div className="rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-100 p-[1px] shadow-lg ring-1 ring-slate-200/70">
                  <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 lg:flex-row lg:items-center lg:gap-8">
                    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-100 shadow-xl ring-1 ring-slate-200/70 lg:w-[360px]">
                      <img
                        src={bestThumbnail.url}
                        alt={selectedVideo.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-900/70 to-transparent px-4 py-3 text-xs text-white/90">
                        <span className="pr-4 font-medium truncate drop-shadow">{selectedVideo.title}</span>
                        {videoWatchUrl && (
                          <a
                            href={videoWatchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-800 shadow-sm transition hover:bg-white"
                          >
                            Watch
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-sm text-slate-600">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Thumbnail preview</p>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">
                          How viewers first encounter this video
                        </h3>
                      </div>
                      <p className="leading-relaxed text-slate-600">
                        Use this snapshot to sense-check your packaging. The brighter the focal point and title, the more
                        likely it pops in crowded feeds.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {bestThumbnail.width > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-600 ring-1 ring-emerald-100">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            {bestThumbnail.width}×{bestThumbnail.height}
                          </span>
                        )}
                        {selectedVideo.publishedAt && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-sky-600 ring-1 ring-sky-100">
                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                            {new Date(selectedVideo.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                        {selectedVideo.channelTitle && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-violet-600 ring-1 ring-violet-100">
                            <span className="h-2 w-2 rounded-full bg-violet-400" />
                            {selectedVideo.channelTitle}
                          </span>
                        )}
                      </div>
                      {videoWatchUrl && (
                        <div className="flex">
                          <a
                            href={videoWatchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            Open on YouTube
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10.75 3a.75.75 0 0 1 .75-.75h5.5A.75.75 0 0 1 17.75 3v5.5a.75.75 0 0 1-1.5 0V4.56l-6.97 6.97a.75.75 0 1 1-1.06-1.06L15.19 3.5h-4.44a.75.75 0 0 1-.75-.75Z"
                                clipRule="evenodd"
                              />
                              <path d="M4.25 5.5A.75.75 0 0 1 5 6.25v9.5h9.5a.75.75 0 0 1 0 1.5h-10A.75.75 0 0 1 3.75 16.5v-10a.75.75 0 0 1 .75-.75Z" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Video:</span>
                  <span className="text-slate-600 truncate max-w-md">{selectedVideo.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedVideo.publishedAt && (
                    <span>
                      Published{' '}
                      <span className="font-medium text-slate-700">
                        {new Date(selectedVideo.publishedAt).toLocaleDateString()}
                      </span>
                    </span>
                  )}
                  {videoPreviousPeriod && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                      vs {videoPreviousPeriod.startDate} → {videoPreviousPeriod.endDate}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {videoHeroMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-slate-200 px-4 py-4 bg-white flex flex-col gap-2"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</p>
                    <div className="text-xl font-semibold text-slate-800">{metric.value}</div>
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 w-max">
                      {metric.delta !== undefined && metric.delta !== null
                        ? `${metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'} ${formatPercent(
                            metric.deltaRatio
                          )}`
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {videoMetricsConfig.map(({ key, label, format }) => {
                  const metric = selectedVideoTotals[key];
                  return (
                    <div key={key} className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                      <div className="text-lg font-semibold text-slate-800">{format(metric.value)}</div>
                      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'} {formatPercent(metric.deltaRatio)}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </Card>
      )}
    </section>
  );
};

export default AnalyticsTab;


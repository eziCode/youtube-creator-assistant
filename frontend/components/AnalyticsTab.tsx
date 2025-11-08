import React, { useEffect, useMemo, useState } from 'react';
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
        value: `${formatNumber((totals.estimatedMinutesWatched?.value ?? 0) / 60, {
          maximumFractionDigits: 1,
        })} hrs`,
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
        key: 'views',
        label: 'Views',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'estimatedMinutesWatched',
        label: 'Watch Time',
        format: (value: number) => `${formatNumber(value / 60, { maximumFractionDigits: 1 })} hrs`,
      },
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
        key: 'netSubscribers',
        label: 'Net Subscribers',
        format: (value: number) => formatNumber(value, { signDisplay: 'always' }),
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
    ],
    []
  );

  const viewSparkline = useMemo(() => {
    if (!dailySeries.length) return { path: '', area: '' };
    const values = dailySeries.map((entry) => Number(entry.views ?? 0));
    const maxValue = Math.max(...values);
    if (maxValue === 0) return { path: '', area: '' };

    const points = values.map((value, idx) => {
      const x = dailySeries.length === 1 ? 50 : (idx / (dailySeries.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 100;
      return { x, y };
    });

    const linePath = points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    const areaPath = `${linePath} L 100 100 L 0 100 Z`;

    return { path: linePath, area: areaPath };
  }, [dailySeries]);

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
        value: `${formatNumber((selectedVideoTotals.estimatedMinutesWatched?.value ?? 0) / 60, {
          maximumFractionDigits: 1,
        })} hrs`,
        delta: selectedVideoTotals.estimatedMinutesWatched?.delta,
        deltaRatio: selectedVideoTotals.estimatedMinutesWatched?.deltaRatio,
      },
    ];
  }, [selectedVideoTotals]);

  const videoSparkline = useMemo(() => {
    if (!videoDailySeries.length) return { path: '', area: '' };

    const values = videoDailySeries.map((entry) => Number(entry.views ?? 0));
    const maxValue = Math.max(...values);
    if (maxValue === 0) return { path: '', area: '' };

    const points = values.map((value, idx) => {
      const x = videoDailySeries.length === 1 ? 50 : (idx / (videoDailySeries.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 100;
      return { x, y };
    });

    const linePath = points
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    const areaPath = `${linePath} L 100 100 L 0 100 Z`;

    return { path: linePath, area: areaPath };
  }, [videoDailySeries]);

  const videoPeakDay = useMemo(() => {
    if (!videoDailySeries.length) return null;
    return videoDailySeries.reduce((best, entry) => {
      if (!best) return entry;
      return (entry.views ?? 0) > (best.views ?? 0) ? entry : best;
    }, videoDailySeries[0]);
  }, [videoDailySeries]);

  const videoMetricsConfig = useMemo(
    () => [
      {
        key: 'views',
        label: 'Views',
        format: (value: number) => formatNumber(value),
      },
      {
        key: 'estimatedMinutesWatched',
        label: 'Watch Time',
        format: (value: number) => `${formatNumber(value / 60, { maximumFractionDigits: 1 })} hrs`,
      },
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
            title="📊 Channel Snapshot"
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

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card title="📈 Daily Views Trend" className="lg:col-span-3">
              {isLoadingChannel && dailySeries.length === 0 ? (
                <div className="skeleton skeleton-panel h-48 w-full" />
              ) : dailySeries.length === 0 ? (
                <div className="text-sm text-slate-500">No daily data yet for the selected period.</div>
              ) : (
                <div className="space-y-4">
                  <div className="h-48 w-full">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                      <defs>
                        <linearGradient id="viewsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(99, 102, 241, 0.35)" />
                          <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                        </linearGradient>
                      </defs>
                      {viewSparkline.area && <path d={viewSparkline.area} fill="url(#viewsGradient)" stroke="none" />}
                      {viewSparkline.path && (
                        <path
                          d={viewSparkline.path}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                  </div>
                  {peakDay && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        Peak Day:{' '}
                        <span className="font-semibold text-slate-700">{peakDay.date}</span>
                      </span>
                      <span>
                        Views:{' '}
                        <span className="font-semibold text-slate-700">{formatNumber(peakDay.views ?? 0)}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card title="💡 Engagement Highlights" className="lg:col-span-2">
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
          </div>
        </>
      )}

      {viewMode === 'video' && (
        <Card
          title="🎬 Selected Video Overview"
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

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Daily Performance</p>
                {videoDailySeries.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No day-by-day data captured for this video yet.
                  </p>
                ) : (
                  <>
                    <div className="h-40 w-full">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                        <defs>
                          <linearGradient id="videoViewsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(249, 115, 22, 0.35)" />
                            <stop offset="100%" stopColor="rgba(249, 115, 22, 0)" />
                          </linearGradient>
                        </defs>
                        {videoSparkline.area && (
                          <path d={videoSparkline.area} fill="url(#videoViewsGradient)" stroke="none" />
                        )}
                        {videoSparkline.path && (
                          <path
                            d={videoSparkline.path}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        )}
                      </svg>
                    </div>
                    {videoPeakDay && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>
                          Peak Day:{' '}
                          <span className="font-semibold text-slate-700">{videoPeakDay.date}</span>
                        </span>
                        <span>
                          Views:{' '}
                          <span className="font-semibold text-slate-700">
                            {formatNumber(videoPeakDay.views ?? 0)}
                          </span>
                        </span>
                        <span>
                          Watch Time:{' '}
                          <span className="font-semibold text-slate-700">
                            {formatNumber((videoPeakDay.estimatedMinutesWatched ?? 0) / 60, {
                              maximumFractionDigits: 1,
                            })}{' '}
                            hrs
                          </span>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </section>
  );
};

export default AnalyticsTab;


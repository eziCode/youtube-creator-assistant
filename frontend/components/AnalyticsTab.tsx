import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AnalyticsTotals,
  ChannelAnalyticsOverview,
  Video,
  VideoAnalyticsOverview,
} from '../types';
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
  customStartDate?: string;
  customEndDate?: string;
  onChangeCustomDateRange?: (startDate: string, endDate: string) => void;
  channelStartDate?: string;
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

const formatIsoDate = (iso?: string | null) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString();
};

const filterAnalyticsByRange = (
  analytics: ChannelAnalyticsOverview | VideoAnalyticsOverview | null,
  startIso: string,
  endIso: string
): typeof analytics => {
  if (!analytics) return analytics;

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return analytics;
  }

  const filteredDaily = (analytics.daily ?? []).filter((entry) => {
    const entryDate = entry.date ? new Date(entry.date) : null;
    if (!entryDate || Number.isNaN(entryDate.getTime())) return false;
    return entryDate >= start && entryDate <= end;
  });

  const baseTotals = analytics.totals;
  const summedTotals =
    baseTotals &&
    (Object.keys(baseTotals) as Array<keyof typeof baseTotals>).reduce<AnalyticsTotals>(
      (acc, key) => {
        const metric = baseTotals[key];
        const totalValue = filteredDaily.reduce<number>((accumulator, entry) => {
          const raw = entry[key as keyof typeof entry];
          const numeric = typeof raw === 'number' ? raw : Number(raw ?? 0);
          return accumulator + (Number.isFinite(numeric) ? numeric : 0);
        }, 0);

        acc[key] = {
          value: totalValue,
          delta: metric?.delta ?? 0,
          deltaRatio: metric?.deltaRatio ?? null,
        };

        return acc;
      },
      {} as AnalyticsTotals
    );

  return {
    ...analytics,
    totals: summedTotals ?? baseTotals,
    daily: filteredDaily,
    period: {
      current: {
        startDate: startIso,
        endDate: endIso,
      },
      previous: null,
    },
  };
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

const toDateOnly = (iso?: string | null) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const clampDateToFloor = (value: string, floor?: string | null) => {
  if (!value) return value;
  if (!floor) return value;
  return value < floor ? floor : value;
};

const getLaterDate = (a?: string | null, b?: string | null) => {
  if (a && b) {
    return a > b ? a : b;
  }
  return a ?? b ?? null;
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
  customStartDate,
  customEndDate,
  onChangeCustomDateRange,
  channelStartDate,
}) => {
  const [viewMode, setViewMode] = useState<'channel' | 'video'>('channel');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(customStartDate ?? '');
  const [tempEndDate, setTempEndDate] = useState(customEndDate ?? '');
  const [isCustomRangeActive, setIsCustomRangeActive] = useState(
    analyticsRangeDays === 0 && Boolean(customStartDate && customEndDate)
  );

  const todayIso = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offsetIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    return offsetIso;
  }, []);

  const channelMinDate = useMemo(() => toDateOnly(channelStartDate), [channelStartDate]);
  const videoMinDate = useMemo(
    () => toDateOnly(selectedVideo?.publishedAt ?? null),
    [selectedVideo?.publishedAt]
  );
  const effectiveMinDate = useMemo(() => {
    if (viewMode === 'video') {
      return getLaterDate(videoMinDate, channelMinDate);
    }
    return channelMinDate ?? null;
  }, [viewMode, videoMinDate, channelMinDate]);

  const activeRange = useMemo(() => {
    if (!isCustomRangeActive || !customStartDate || !customEndDate) return null;
    const floor = effectiveMinDate ?? null;
    const normalizedStart =
      floor && customStartDate < floor ? floor : customStartDate;
    const normalizedEnd =
      normalizedStart > customEndDate ? normalizedStart : customEndDate;
    return { start: normalizedStart, end: normalizedEnd };
  }, [isCustomRangeActive, customStartDate, customEndDate, effectiveMinDate]);

  const isCustomRangeReady = useMemo(() => {
    if (!tempStartDate || !tempEndDate) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tempStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(tempEndDate)) {
      return false;
    }
    if (effectiveMinDate && tempStartDate < effectiveMinDate) {
      return false;
    }
    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return start <= end;
  }, [tempStartDate, tempEndDate, effectiveMinDate]);

  const endDateMinimum = useMemo(() => {
    const candidates = [effectiveMinDate, tempStartDate].filter(Boolean) as string[];
    if (!candidates.length) {
      return undefined;
    }
    return candidates.reduce((latest, date) => (date > latest ? date : latest), candidates[0]);
  }, [effectiveMinDate, tempStartDate]);

  useEffect(() => {
    if (!selectedVideo && viewMode === 'video') {
      setViewMode('channel');
    }
  }, [selectedVideo, viewMode]);

  useEffect(() => {
    setTempStartDate(customStartDate ?? '');
    setTempEndDate(customEndDate ?? '');
  }, [customStartDate, customEndDate]);

  useEffect(() => {
    if (!effectiveMinDate) return;
    setTempStartDate((prev) => {
      if (!prev) return prev;
      return prev < effectiveMinDate ? effectiveMinDate : prev;
    });
  }, [effectiveMinDate]);

  useEffect(() => {
    setTempEndDate((prev) => {
      if (!prev) return prev;
      let next = prev;
      if (effectiveMinDate && next < effectiveMinDate) {
        next = effectiveMinDate;
      }
      if (tempStartDate && next < tempStartDate) {
        next = tempStartDate;
      }
      return next === prev ? prev : next;
    });
  }, [effectiveMinDate, tempStartDate]);

  useEffect(() => {
    setIsCustomRangeActive(analyticsRangeDays === 0 && Boolean(customStartDate && customEndDate));
  }, [analyticsRangeDays, customStartDate, customEndDate]);

  const canUseCustomRange = typeof onChangeCustomDateRange === 'function';

  const handlePresetClick = useCallback(
    (days: number) => {
      setShowDatePicker(false);
      setIsCustomRangeActive(false);
      onChangeRangeDays(days);
    },
    [onChangeRangeDays]
  );

  const handleApplyCustomRange = useCallback(() => {
    if (!isCustomRangeReady) {
      return;
    }

    if (!canUseCustomRange) {
      setShowDatePicker(false);
      return;
    }

    let normalizedStart = tempStartDate;
    if (effectiveMinDate && normalizedStart < effectiveMinDate) {
      normalizedStart = effectiveMinDate;
    }
    let normalizedEnd = tempEndDate;
    if (normalizedEnd < normalizedStart) {
      normalizedEnd = normalizedStart;
    }

    onChangeCustomDateRange?.(normalizedStart, normalizedEnd);
    setTempStartDate(normalizedStart);
    setTempEndDate(normalizedEnd);
    setIsCustomRangeActive(true);
    onChangeRangeDays(0);
    setShowDatePicker(false);
  }, [
    canUseCustomRange,
    isCustomRangeReady,
    onChangeCustomDateRange,
    tempStartDate,
    tempEndDate,
    onChangeRangeDays,
    effectiveMinDate,
  ]);

  const isLoadingChannel = isLoadingVideos || isLoadingAnalytics;

  const filteredAnalytics = useMemo(() => {
    if (!activeRange) return analytics;
    return filterAnalyticsByRange(analytics, activeRange.start, activeRange.end) as ChannelAnalyticsOverview;
  }, [analytics, activeRange]);

  const filteredVideoAnalytics = useMemo(() => {
    if (!activeRange) return videoAnalytics;
    return filterAnalyticsByRange(videoAnalytics, activeRange.start, activeRange.end) as VideoAnalyticsOverview;
  }, [videoAnalytics, activeRange]);

  const totals = filteredAnalytics?.totals;
  const dailySeries = filteredAnalytics?.daily ?? [];
  const currentPeriod = filteredAnalytics?.period.current;
  const previousPeriod = filteredAnalytics?.period.previous;

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


  const hasAnalyticsData = Boolean(filteredAnalytics && totals);
  const showEmptyState =
    !isLoadingChannel && !hasAnalyticsData && !analyticsError && !videoError;

  const highlightInsights = useMemo(() => {
    if (!totals) return [];
    const insights: Array<{ title: string; detail: string }> = [];

    if (totals.views && totals.views.delta !== null && totals.views.deltaRatio !== null) {
      insights.push({
        title: 'View Momentum',
        detail: `Views ${totals.views.delta >= 0 ? 'grew' : 'declined'} by ${formatPercent(
          totals.views.deltaRatio
        )} compared to the previous period.`,
      });
    }

    if (
      totals.averageViewDuration &&
      totals.averageViewDuration.delta !== null &&
      totals.averageViewDuration.deltaRatio !== null
    ) {
      insights.push({
        title: 'Retention Health',
        detail: `Average viewers stayed for ${formatDuration(
          totals.averageViewDuration.value
        )}, a change of ${formatPercent(totals.averageViewDuration.deltaRatio)}.`,
      });
    }

    if (totals.netSubscribers && totals.netSubscribers.delta !== null) {
      insights.push({
        title: 'Subscriber Impact',
        detail: `Net subscribers ${totals.netSubscribers.delta >= 0 ? 'increased' : 'decreased'} by ${
          totals.netSubscribers.delta >= 0 ? '+' : ''
        }${formatNumber(totals.netSubscribers.delta)}.`,
      });
    }

    return insights;
  }, [totals]);

  const selectedVideoTotals = filteredVideoAnalytics?.totals;
  const videoDailySeries = filteredVideoAnalytics?.daily ?? [];
  const videoPeriod = filteredVideoAnalytics?.period?.current;
  const videoPreviousPeriod = filteredVideoAnalytics?.period?.previous;

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
    <section className="space-y-10 text-white">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-white drop-shadow-sm">Analytics & Insights</h2>
          <p className="text-sm text-white/60">
            {isLoadingChannel
              ? 'Syncing latest stats…'
              : isCustomRangeActive && customStartDate && customEndDate
                ? `Reporting ${formatIsoDate(customStartDate)} → ${formatIsoDate(customEndDate)}`
                : hasAnalyticsData && currentPeriod
                ? `Reporting ${formatIsoDate(currentPeriod.startDate)} → ${formatIsoDate(currentPeriod.endDate)}`
                : `Tracking ${videos.length} video${videos.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 shadow-inner shadow-white/10">
            {[7, 28, 90].map((days) => {
              const isActive = !isCustomRangeActive && analyticsRangeDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => handlePresetClick(days)}
                  className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? 'rounded-full bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 text-white shadow-[0_12px_25px_rgba(99,102,241,0.45)]'
                      : 'text-white/60 hover:text-white'
                  }`}
                  aria-pressed={isActive}
                >
                  Last {days}d
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                isCustomRangeActive
                  ? 'rounded-full bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 text-white shadow-[0_12px_25px_rgba(99,102,241,0.45)]'
                  : 'text-white/60 hover:text-white'
              }`}
              aria-pressed={isCustomRangeActive}
            >
              Custom
            </button>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 shadow-inner shadow-white/10">
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
                  className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    isActive
                      ? 'rounded-full bg-gradient-to-r from-sky-500/80 to-indigo-500/80 text-white shadow-[0_12px_25px_rgba(59,130,246,0.35)]'
                      : 'text-white/60 hover:text-white'
                  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
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

      {showDatePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
          onClick={() => setShowDatePicker(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-white shadow-[0_25px_60px_rgba(15,23,42,0.6)] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Select custom range</h3>
            <p className="mt-1 text-sm text-white/60">
              Pick a start and end date to drill into a specific window.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-white/80">
                Start date
                <input
                  type="date"
                  value={tempStartDate}
                  max={todayIso}
                  min={effectiveMinDate ?? undefined}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      setTempStartDate('');
                      return;
                    }
                    const clamped = clampDateToFloor(value, effectiveMinDate);
                    setTempStartDate(clamped);
                    setTempEndDate((prev) => {
                      if (!prev) return prev;
                      return prev < clamped ? clamped : prev;
                    });
                  }}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-white/80">
                End date
                <input
                  type="date"
                  value={tempEndDate}
                  min={endDateMinimum}
                  max={todayIso}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      setTempEndDate('');
                      return;
                    }
                    let clamped = value;
                    if (effectiveMinDate && clamped < effectiveMinDate) {
                      clamped = effectiveMinDate;
                    }
                    if (tempStartDate && clamped < tempStartDate) {
                      clamped = tempStartDate;
                    }
                    setTempEndDate(clamped);
                  }}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </label>
            </div>

            {tempStartDate && tempEndDate && !isCustomRangeReady && (
              <p className="mt-2 text-xs font-medium text-rose-300">
                Start date must be on or before the end date.
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustomRange}
                disabled={!isCustomRangeReady}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(99,102,241,0.4)] transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
              >
                Apply range
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'channel' && (analyticsError || videoError) && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-inner shadow-rose-500/10">
          {analyticsError ?? videoError}
        </div>
      )}

      {viewMode === 'channel' && showEmptyState && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60 shadow-inner shadow-white/5">
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
              {isLoadingChannel
                ? Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`channel-pulse-skeleton-${idx}`}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-5 shadow-inner shadow-white/5"
                    >
                      <div className="skeleton skeleton-xs w-20 rounded-full" />
                      <div className="skeleton skeleton-xl w-28" />
                      <div className="flex items-center gap-2">
                        <div className="skeleton skeleton-chip w-20" />
                        <div className="skeleton skeleton-xs flex-1 rounded-full" />
                      </div>
                    </div>
                  ))
                : channelHeroMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-indigo-900/40 px-5 py-6 shadow-[0_14px_35px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-white/30"
                    >
                      <div className="text-xs uppercase tracking-[0.25em] text-white/50">{metric.label}</div>
                      <div className="text-3xl font-semibold text-white">{metric.value}</div>
                      <div className="inline-flex items-center gap-2 text-xs font-medium text-white/70">
                        {metric.delta !== undefined && metric.delta !== null ? (
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                              (metric.delta ?? 0) > 0
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : (metric.delta ?? 0) < 0
                                ? 'bg-rose-500/15 text-rose-200'
                                : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {metric.delta !== undefined && metric.delta !== null
                              ? `${metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'} ${formatPercent(
                                  metric.deltaRatio
                                )}`
                              : '—'}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">—</span>
                        )}
                        <span className="text-white/50">
                          {previousPeriod ? 'vs previous' : isCustomRangeActive ? 'custom range' : 'current window'}
                        </span>
                      </div>
                    </div>
                  ))}
              {channelHeroMetrics.length === 0 && !isLoadingChannel && (
                <div className="col-span-full text-sm text-white/60">
                  No channel metrics available for this window.
                </div>
              )}
            </div>
          </Card>

          <Card
            title="Channel Snapshot"
            description={
              isLoadingChannel ? (
                <div className="skeleton skeleton-sm w-52" />
              ) : isCustomRangeActive && customStartDate && customEndDate ? (
                <span>
                  Custom range {formatIsoDate(customStartDate)} → {formatIsoDate(customEndDate)}
                </span>
              ) : previousPeriod ? (
                <span>
                  Comparing {formatIsoDate(currentPeriod?.startDate)} → {formatIsoDate(currentPeriod?.endDate)} against{' '}
                  {formatIsoDate(previousPeriod.startDate)} → {formatIsoDate(previousPeriod.endDate)}
                </span>
              ) : undefined
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {metricsConfig.map(({ key, label, format }) => {
                const metric = totals?.[key];
                return (
                  <div key={key} className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">{label}</p>
                    {isLoadingChannel ? (
                      <div className="skeleton skeleton-lg w-24" />
                    ) : metric ? (
                      <>
                        <div className="text-2xl font-semibold text-white">{format(metric.value)}</div>
                        <div className="flex items-center gap-2 text-xs">
                          {metric.delta !== undefined && metric.delta !== null ? (
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
                                metric.delta > 0
                                  ? 'bg-emerald-500/15 text-emerald-200'
                                  : metric.delta < 0
                                  ? 'bg-rose-500/15 text-rose-200'
                                  : 'bg-white/10 text-white/60'
                              }`}
                            >
                              {metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'} {formatPercent(metric.deltaRatio)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 font-semibold text-white/60">
                              —
                            </span>
                          )}
                          <span className="text-white/50">
                            {previousPeriod ? 'vs previous' : isCustomRangeActive ? 'custom range' : 'current window'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-white/50">No data available</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Engagement Highlights">
            {isLoadingChannel ? (
              <div className="space-y-3">
                <div className="skeleton skeleton-sm w-48" />
                <div className="skeleton skeleton-sm w-56" />
                <div className="skeleton skeleton-sm w-40" />
              </div>
            ) : highlightInsights.length > 0 ? (
              <ul className="space-y-4 text-sm text-white/70">
                {highlightInsights.map((insight) => (
                  <li key={insight.title}>
                    <p className="font-semibold text-white">{insight.title}</p>
                    <p className="mt-1 text-white/70">{insight.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/60">
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
            !selectedVideo
              ? 'Pick a published video from the sidebar to explore its performance.'
              : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white/70">{selectedVideo.title}</span>
                    {isLoadingVideoAnalytics ? (
                      <div className="skeleton skeleton-xs w-32" />
                    ) : isCustomRangeActive && customStartDate && customEndDate ? (
                      <span className="text-white/60">
                        {formatIsoDate(customStartDate)} → {formatIsoDate(customEndDate)}
                      </span>
                    ) : videoPeriod ? (
                      <span className="text-white/60">
                        {formatIsoDate(videoPeriod.startDate)} → {formatIsoDate(videoPeriod.endDate)}
                      </span>
                    ) : null}
                  </div>
                )
          }
        >
          {!selectedVideo ? (
            <p className="text-sm text-white/60">Select a video from the sidebar to dive into specifics.</p>
          ) : (
            <div className="space-y-6">
              {bestThumbnail && (
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-indigo-900/40 p-[1px] shadow-[0_18px_50px_rgba(15,23,42,0.55)]">
                  <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-slate-950/70 p-5 lg:flex-row lg:items-center lg:gap-8">
                    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-[0_18px_45px_rgba(15,23,42,0.45)] lg:w-[360px]">
                      <img
                        src={bestThumbnail.url}
                        alt={selectedVideo.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 to-transparent px-4 py-3 text-xs text-white/90">
                        <span className="pr-4 font-medium truncate drop-shadow-lg">{selectedVideo.title}</span>
                        {videoWatchUrl && (
                          <a
                            href={videoWatchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            Watch
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-sm text-white/70">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Thumbnail preview</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">
                          How viewers first encounter this video
                        </h3>
                      </div>
                      <p className="leading-relaxed text-white/70">
                        Use this snapshot to sense-check your packaging. The brighter the focal point and title, the more
                        likely it pops in crowded feeds.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                        {bestThumbnail.width > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-emerald-200 shadow-inner shadow-emerald-500/10">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            {bestThumbnail.width}×{bestThumbnail.height}
                          </span>
                        )}
                        {selectedVideo.publishedAt && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-500/15 px-3 py-1 text-sky-200 shadow-inner shadow-sky-500/10">
                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                            {new Date(selectedVideo.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                        {selectedVideo.channelTitle && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-1 text-violet-200 shadow-inner shadow-violet-500/10">
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
                            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_20px_45px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(99,102,241,0.45)]"
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

              {videoAnalyticsError ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-inner shadow-rose-500/10">
                  {videoAnalyticsError}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white/80">Video:</span>
                      <span className="max-w-md truncate text-white/70">{selectedVideo.title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedVideo.publishedAt && (
                        <span>
                          Published{' '}
                          <span className="font-medium text-white/80">
                            {new Date(selectedVideo.publishedAt).toLocaleDateString()}
                          </span>
                        </span>
                      )}
                      <div className="min-w-[150px]">
                        {isLoadingVideoAnalytics ? (
                          <div className="skeleton skeleton-xs w-36" />
                        ) : videoPreviousPeriod ? (
                          <span className="text-xs font-semibold text-white rounded-full border border-white/10 bg-white/10 px-3 py-1">
                            vs {videoPreviousPeriod.startDate} → {videoPreviousPeriod.endDate}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {isLoadingVideoAnalytics ? (
                    <div className="space-y-4">
                      <div className="skeleton skeleton-sm w-48" />
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div key={`video-hero-skeleton-${idx}`} className="skeleton skeleton-panel h-24 w-full" />
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, idx) => (
                          <div key={`video-metric-skeleton-${idx}`} className="skeleton skeleton-panel h-20 w-full" />
                        ))}
                      </div>
                    </div>
                  ) : selectedVideoTotals ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {videoHeroMetrics.map((metric) => (
                          <div
                            key={metric.label}
                            className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-slate-950/60 px-5 py-4 shadow-[0_14px_35px_rgba(15,23,42,0.45)]"
                          >
                            <p className="text-xs uppercase tracking-[0.25em] text-white/40">{metric.label}</p>
                            <div className="text-2xl font-semibold text-white">{metric.value}</div>
                            <div className="inline-flex w-max items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
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
                          const hasDelta = metric.delta !== undefined && metric.delta !== null;
                          return (
                            <div key={key} className="space-y-2">
                              <p className="text-xs uppercase tracking-[0.25em] text-white/40">{label}</p>
                              <div className="text-lg font-semibold text-white">{format(metric.value)}</div>
                              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                                {hasDelta
                                  ? `${metric.delta > 0 ? '▲' : metric.delta < 0 ? '▼' : '—'} ${formatPercent(
                                      metric.deltaRatio
                                    )}`
                                  : '—'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-white/60">
                      We couldn&apos;t find analytics for this video during the selected period.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </section>
  );
};

export default AnalyticsTab;


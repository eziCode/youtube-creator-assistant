import React, { useMemo } from 'react';
import { Video } from '../types';
import Card from './Card';

interface AnalyticsTabProps {
  videos: Video[];
  isLoading: boolean;
  error: string | null;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ videos, isLoading, error }) => {
  const totals = useMemo(() => {
    return videos.reduce(
      (acc, video) => {
        acc.totalViews += video.viewCount ?? 0;
        acc.totalLikes += video.likeCount ?? 0;
        acc.totalComments += video.commentCount ?? 0;
        return acc;
      },
      { totalViews: 0, totalLikes: 0, totalComments: 0 }
    );
  }, [videos]);

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Analytics & Insights</h2>
        <div className="text-sm text-slate-500">
          {isLoading ? 'Syncing latest stats…' : `Loaded ${videos.length} video${videos.length === 1 ? '' : 's'}.`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card title="Total Views">
          {isLoading ? (
            <div className="h-10 bg-slate-200 rounded-md animate-pulse" />
          ) : (
            <div className="text-3xl font-bold text-slate-800">
              {totals.totalViews.toLocaleString()}
            </div>
          )}
        </Card>
        <Card title="Total Likes">
          {isLoading ? (
            <div className="h-10 bg-slate-200 rounded-md animate-pulse" />
          ) : (
            <div className="text-3xl font-bold text-slate-800">
              {totals.totalLikes.toLocaleString()}
            </div>
          )}
        </Card>
        <Card title="Total Comments">
          {isLoading ? (
            <div className="h-10 bg-slate-200 rounded-md animate-pulse" />
          ) : (
            <div className="text-3xl font-bold text-slate-800">
              {totals.totalComments.toLocaleString()}
            </div>
          )}
        </Card>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-rose-200 bg-rose-50 text-rose-700 text-sm rounded-md">
          Unable to load live analytics: {error}
        </div>
      )}

      {!isLoading && !error && videos.length === 0 && (
        <div className="mb-6 p-4 border border-slate-200 bg-slate-50 text-slate-600 text-sm rounded-md">
          We couldn&apos;t find any videos on your channel. Publish a video and refresh to see analytics.
        </div>
      )}
    </section>
  );
};

export default AnalyticsTab;

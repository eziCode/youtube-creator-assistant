import React, { useState, useEffect, useMemo } from 'react';
import { Video } from '../types';
import Card from './Card';
import { generateAiInsights } from '../services/geminiService';

interface AnalyticsTabProps {
  videos: Video[];
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ videos }) => {
  const [aiInsights, setAiInsights] = useState<string>('Generating insights...');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      const insights = await generateAiInsights(videos);
      setAiInsights(insights);
      setIsLoading(false);
    };
    fetchInsights();
  }, [videos]);

  const totals = useMemo(() => {
    const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
    const totalWatchTime = videos.reduce((sum, v) => sum + v.watchTime, 0);
    const avgRetention = videos.reduce((sum, v) => sum + v.retention, 0) / videos.length;
    return { totalViews, totalWatchTime, avgRetention };
  }, [videos]);

  const topVideos = useMemo(() => {
      return [...videos].sort((a, b) => b.views - a.views).slice(0, 5);
  }, [videos]);

  return (
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Analytics & Insights</h2>
        <div className="text-sm text-slate-500">Last 30 days (mock)</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card title="Total Views">
          <div className="text-3xl font-bold text-slate-800">{totals.totalViews.toLocaleString()}</div>
        </Card>
        <Card title="Watch Time (hrs)">
          <div className="text-3xl font-bold text-slate-800">{Math.round(totals.totalWatchTime).toLocaleString()}</div>
        </Card>
        <Card title="Avg. Retention">
          <div className="text-3xl font-bold text-slate-800">{(totals.avgRetention * 100).toFixed(0)}%</div>
        </Card>
      </div>
      
      <div className="mb-6">
        <Card title="Views Over Time">
            <div className="w-full h-48 bg-gradient-to-tr from-indigo-50 to-sky-50 rounded-lg flex items-center justify-center text-slate-600 p-2">
                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: 'rgba(99, 102, 241, 0.4)' }} />
                            <stop offset="100%" style={{ stopColor: 'rgba(99, 102, 241, 0)' }} />
                        </linearGradient>
                    </defs>
                    <path d="M 0 80 C 50 60, 100 70, 150 40 S 250 10, 300 20 L 300 100 L 0 100 Z" fill="url(#gradient)" />
                    <path d="M 0 80 C 50 60, 100 70, 150 40 S 250 10, 300 20" fill="none" stroke="#6366f1" strokeWidth="2" />
                </svg>
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="AI-Powered Insights">
          {isLoading ? (
             <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
              </div>
          ) : (
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{aiInsights}</pre>
          )}
        </Card>
        <Card title="Top Performing Videos">
          <ul className="space-y-3 text-sm">
            {topVideos.map(v => (
              <li key={v.id} className="flex justify-between items-center">
                <span className="truncate pr-4 max-w-xs font-medium text-slate-700">{v.title}</span>
                <span className="text-xs text-slate-500 font-semibold bg-slate-200 px-2 py-1 rounded-md">{v.views.toLocaleString()} views</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
};

export default AnalyticsTab;

export type Sentiment = "positive" | "negative" | "question";
export type Tone = "Friendly" | "Professional" | "Comedic" | "Sarcastic";
export type Tab = "analytics" | "comments" | "shorts" | "settings";
export type RiskLevel = "low" | "high";
export type CommentStatus = "pending" | "approved" | "auto-replied";

export interface Video {
  id: string;
  title: string;
  description?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
  publishedAt?: string | null;
  thumbnails?: Record<
    string,
    {
      url?: string;
      width?: number;
      height?: number;
    }
  >;
  duration?: string | null;
  tags?: string[];
  liveBroadcastContent?: string | null;
  defaultLanguage?: string | null;
  defaultAudioLanguage?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  favoriteCount?: number | null;
  categoryId?: string | null;
}

export interface Comment {
  id: number;
  user: string;
  text: string;
  sentiment: Sentiment;
  risk: RiskLevel;
  suggestedReply: string;
  status: CommentStatus;
}

export interface ShortClip {
  startTime: number;
  endTime: number;
  title: string;
  reason: string;
  hook: string;
}

export type ShortDownloadStatus = "pending" | "downloading" | "completed" | "cancelled" | "failed";

export interface ShortDownload {
  id: string;
  videoId: string;
  status: ShortDownloadStatus;
  filePath?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export type ShortPublicationStatus = "queued" | "processing" | "completed" | "failed";

export interface ShortPublicationResult {
  jobId: string;
  status: ShortPublicationStatus;
  shareUrl?: string;
  estimatedProcessingSeconds?: number;
  message?: string;
  metadata?: {
    videoId: string;
    startTime: number;
    endTime: number;
    title?: string;
    hook?: string;
    reason?: string;
  };
}

export interface AuthenticatedUser {
  id: string;
  googleId: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
}

export interface AnalyticsValue {
  value: number;
  delta: number;
  deltaRatio: number | null;
}

export interface AnalyticsTotals {
  views: AnalyticsValue;
  estimatedMinutesWatched: AnalyticsValue;
  averageViewDuration: AnalyticsValue;
  averageViewPercentage: AnalyticsValue;
  likes: AnalyticsValue;
  comments: AnalyticsValue;
  shares: AnalyticsValue;
  subscribersGained: AnalyticsValue;
  subscribersLost: AnalyticsValue;
  netSubscribers: AnalyticsValue;
  [key: string]: AnalyticsValue;
}

export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
}

export interface AnalyticsDailyEntry {
  date: string;
  views?: number;
  estimatedMinutesWatched?: number;
  averageViewDuration?: number;
  averageViewPercentage?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  subscribersGained?: number;
  subscribersLost?: number;
  [key: string]: string | number | undefined;
}

export interface AnalyticsVideoPerformance {
  videoId: string;
  views?: number;
  estimatedMinutesWatched?: number;
  averageViewDuration?: number;
  averageViewPercentage?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  subscribersGained?: number;
  subscribersLost?: number;
  [key: string]: string | number | undefined;
}

export interface ChannelAnalyticsOverview {
  period: {
    current: AnalyticsPeriod;
    previous: AnalyticsPeriod;
  };
  totals: AnalyticsTotals;
  daily: AnalyticsDailyEntry[];
  topVideos: AnalyticsVideoPerformance[];
}

export interface VideoAnalyticsOverview extends ChannelAnalyticsOverview {
  videoId: string;
}

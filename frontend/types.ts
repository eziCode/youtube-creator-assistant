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
  start: number;
  end: number;
  reason: string;
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

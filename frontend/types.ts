export type Sentiment = "positive" | "negative" | "question";
export type Tone = "Friendly" | "Professional" | "Comedic" | "Sarcastic";
export type Tab = "analytics" | "comments" | "shorts" | "settings";
export type RiskLevel = "low" | "high";
export type CommentStatus = "pending" | "approved" | "auto-replied";

export interface Video {
  id: string;
  title: string;
  views: number;
  watchTime: number; // in hours
  retention: number; // as a decimal, e.g., 0.62 for 62%
  likes: number;
  commentsCount: number;
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
}

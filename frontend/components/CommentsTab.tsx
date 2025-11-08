import React, { useEffect, useMemo, useState } from 'react';
import type {
  AuthenticatedUser,
  Comment as CommentType,
  CommentStatus,
  RiskLevel,
  Sentiment,
  Tone,
  Video,
} from '../types';
import { API_BASE_URL } from '../constants';
import { regenerateReply } from '../services/geminiService';
import { RobotIcon, InboxIcon } from './icons';

interface CommentsTabProps {
  tone: Tone;
  selectedVideo: Video | null;
  user: AuthenticatedUser | null;
}

const QUESTION_TOKENS = ['?', 'who', 'what', 'when', 'where', 'why', 'how', 'can you'];
const NEGATIVE_TOKENS = ['hate', 'bad', 'terrible', 'awful', 'issue', 'problem', 'hard', 'difficult', 'confusing'];
const POSITIVE_TOKENS = ['love', 'great', 'awesome', 'amazing', 'good', 'helpful', 'thanks', 'thank you'];

const inferSentiment = (text: string): Sentiment => {
  const lower = text.toLowerCase();
  if (!lower) return 'neutral';

  if (QUESTION_TOKENS.some((token) => lower.includes(token))) {
    return 'question';
  }
  if (NEGATIVE_TOKENS.some((token) => lower.includes(token))) {
    return 'negative';
  }
  if (POSITIVE_TOKENS.some((token) => lower.includes(token))) {
    return 'positive';
  }

  return 'neutral';
};

const deriveRisk = (sentiment: Sentiment): RiskLevel =>
  sentiment === 'negative' || sentiment === 'question' ? 'high' : 'low';

const stripHtml = (value: string | undefined | null) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : '';

const CommentsTab: React.FC<CommentsTabProps> = ({ tone, selectedVideo, user }) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

  useEffect(() => {
    setRegenerateError(null);
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (!selectedVideo?.id) {
      setComments([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchComments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/retrieve-comments?videoId=${encodeURIComponent(selectedVideo.id)}`,
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
              : `Failed to load comments (status ${response.status})`;
          throw new Error(message);
        }

        const creatorChannelId = user?.channelId ?? null;
        const fetched: CommentType[] = Array.isArray(payload?.comments) ? payload.comments : [];
        const normalized = fetched.map((comment) => {
          const replies = Array.isArray(comment.replies)
            ? comment.replies.map((reply) => ({
                ...reply,
                text: stripHtml(reply.text),
              }))
            : [];
          const sanitizedText = stripHtml(comment.text);
          const sentiment = comment.sentiment ?? inferSentiment(sanitizedText);
          const risk = comment.risk ?? deriveRisk(sentiment);
          const creatorReply = creatorChannelId
            ? replies.find((reply) => reply.author?.channelId && reply.author.channelId === creatorChannelId)
            : undefined;
          const suggestedReply = creatorReply?.text ?? comment.suggestedReply ?? '';
          const status: CommentStatus = creatorReply ? 'auto-replied' : comment.status ?? 'pending';

          return {
            ...comment,
            text: sanitizedText,
            replies,
            sentiment,
            risk,
            suggestedReply,
            status,
          } as CommentType;
        });

        setComments(normalized);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[comments] failed to load', err);
        setComments([]);
        setError(err instanceof Error ? err.message : 'Failed to load comments');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchComments();

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, selectedVideo?.id, user?.channelId]);

  const setCommentStatus = (id: string, status: CommentStatus) => {
    setComments((prev) => prev.map((comment) => (comment.id === id ? { ...comment, status } : comment)));
  };

  const updateSuggestedReply = (id: string, text: string) => {
    setComments((prev) => prev.map((comment) => (comment.id === id ? { ...comment, suggestedReply: text } : comment)));
  };

  const handleRegenerate = async (comment: CommentType) => {
    setRegenerateError(null);
    setIsRegenerating(comment.id);

    try {
      const newReply = await regenerateReply(comment, tone, { videoTitle: selectedVideo?.title });
      updateSuggestedReply(comment.id, newReply);
    } catch (err) {
      console.error('[comments] regenerate failed', err);
      const message = err instanceof Error ? err.message : 'Failed to regenerate reply';
      setRegenerateError(message);
    } finally {
      setIsRegenerating(null);
    }
  };

  const { needsReviewComments, autoRepliedComments } = useMemo(() => {
    return comments.reduce(
      (acc, comment) => {
        if (comment.status === 'auto-replied') {
          acc.autoRepliedComments.push(comment);
        } else {
          acc.needsReviewComments.push(comment);
        }
        return acc;
      },
      { needsReviewComments: [] as CommentType[], autoRepliedComments: [] as CommentType[] },
    );
  }, [comments]);

  const renderStatusMessage = () => {
    if (!selectedVideo?.id) {
      return <p className="text-sm text-white/60">Select a video from the sidebar to review its comments.</p>;
    }
    if (isLoading) {
      return <p className="text-sm text-white/60">Loading comments from YouTube…</p>;
    }
    if (error) {
      return <p className="text-sm text-rose-300">{error}</p>;
    }
    if (!comments.length) {
      return <p className="text-sm text-white/60">No comments found for this video yet. Check back soon.</p>;
    }
    return null;
  };

  return (
    <section className="space-y-9 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-semibold text-white drop-shadow-sm">Comments & Replies</h2>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 shadow-inner shadow-white/10">
          <span className="text-white/50">Current Tone</span>
          <strong className="rounded-full bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_12px_25px_rgba(99,102,241,0.35)]">
            {tone}
          </strong>
        </div>
      </div>

      <div className="space-y-2">
        {renderStatusMessage()}
        {regenerateError && <p className="text-sm text-rose-300">{regenerateError}</p>}
      </div>

      <div className="space-y-8">
        <div>
          <div className="mb-4 flex items-center gap-3 text-indigo-200">
            <RobotIcon />
            <h3 className="text-lg font-semibold text-white">
              Auto-Replied by AI ({autoRepliedComments.length})
            </h3>
          </div>
          <div className="space-y-4">
            {autoRepliedComments.length === 0 && (
              <p className="pl-8 text-sm text-white/60">No comments have been auto-replied to yet.</p>
            )}
            {autoRepliedComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-inner shadow-emerald-500/10"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{comment.author.displayName}</div>
                    <p className="mt-1 text-sm text-white/80">{comment.text}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      {comment.risk} Risk
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      {comment.sentiment}
                    </span>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/10">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    AI Reply (Posted)
                  </label>
                  <p className="text-sm text-white/80">{comment.suggestedReply}</p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setCommentStatus(comment.id, 'pending')}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white"
                  >
                    Undo Auto-Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-3 text-white/70">
            <InboxIcon />
            <h3 className="text-lg font-semibold text-white">
              For Your Review ({needsReviewComments.length})
            </h3>
          </div>
          <div className="space-y-4">
            {needsReviewComments.length === 0 && (
              <p className="pl-8 text-sm text-white/60">Your review queue is empty. Great job!</p>
            )}
            {needsReviewComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{comment.author.displayName}</div>
                    <p className="mt-1 text-sm text-white/80">{comment.text}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      {comment.risk} Risk
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      {comment.sentiment}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-12">
                  <div className="col-span-12 md:col-span-9">
                    <label
                      htmlFor={`reply-${comment.id}`}
                      className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-white/50"
                    >
                      AI-Suggested Reply
                    </label>
                    <textarea
                      id={`reply-${comment.id}`}
                      value={comment.suggestedReply ?? ''}
                      onChange={(event) => updateSuggestedReply(comment.id, event.target.value)}
                      className="h-24 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    />
                  </div>
                  <div className="col-span-12 flex flex-row gap-2 md:col-span-3 md:flex-col">
                    <button
                      onClick={() => setCommentStatus(comment.id, 'approved')}
                      disabled={comment.status === 'approved'}
                      className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                        comment.status === 'approved'
                          ? 'cursor-default border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-[0_12px_30px_rgba(16,185,129,0.25)]'
                          : 'border border-white/20 bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 text-white shadow-[0_20px_45px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(99,102,241,0.45)]'
                      }`}
                    >
                      {comment.status === 'approved' ? '✓ Approved' : 'Approve & Post'}
                    </button>
                    <button
                      onClick={() => handleRegenerate(comment)}
                      disabled={isRegenerating === comment.id}
                      className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-wait disabled:opacity-50"
                    >
                      {isRegenerating === comment.id ? 'Thinking…' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommentsTab;


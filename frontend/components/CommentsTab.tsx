import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { generateReplyPreview, regenerateReply } from '../services/geminiService';
import { RobotIcon, InboxIcon } from './icons';

interface CommentsTabProps {
  tone: Tone;
  selectedVideo: Video | null;
  user: AuthenticatedUser | null;
  isDemoMode?: boolean;
  demoChannelTitle?: string;
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

const DISPLAY_MIN = 12;
const DISPLAY_MAX = 18;

const DEMO_VIEWERS = [
  'Avery',
  'Jordan',
  'Harper',
  'Sky',
  'Kai',
  'Rowan',
  'Ember',
  'Nova',
  'Indie',
  'Sage',
  'Mika',
  'Phoenix',
  'Luca',
  'Remy',
  'Quinn',
  'Holland',
  'Blair',
  'Sloane',
  'River',
  'Jules',
];

const DEMO_COMMENTS = [
  'This breakdown is exactly what I needed today.',
  'Can you clarify how you set up the lighting?',
  'Your energy always brightens my feed!',
  'The pace felt a little fast in the second half.',
  'I never miss these uploads—keep them coming.',
  'Any chance you’ll cover monetization next?',
  'This tip saved me so much time.',
  'I laughed so hard at the intro gag 😂',
  'What mic are you using in this video?',
  'I tried this trick and it totally worked!',
  'Could you share the template you mentioned?',
  'Love seeing behind-the-scenes like this.',
  'This is the clearest explanation I’ve seen.',
  'Please do more breakdowns like this one!',
  'I shared this with my team immediately.',
  'How often should we repeat this process?',
  'This is such a chill vibe, thanks!',
  'I’m confused about the third step, help?',
  'Love the thumbnail—who designed it?',
  'I needed this reminder today.',
];

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const wait = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const pickDemoComments = (limit: number): CommentType[] => {
  const total = Math.min(limit, DEMO_COMMENTS.length);
  const shuffled = DEMO_COMMENTS.map((text, index) => ({
    text,
    sortKey: Math.random(),
    index,
  }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, total);

  return shuffled.map(({ text, index }, idx) => {
    const name = DEMO_VIEWERS[(index + idx) % DEMO_VIEWERS.length];
    const sentiment = inferSentiment(text);
    const risk = deriveRisk(sentiment);

    return {
      id: `demo-comment-${index}`,
      text,
      author: {
        displayName: name,
        channelId: null,
      },
      sentiment,
      risk,
      suggestedReply: '',
      status: 'pending',
      autoReplyId: null,
      replies: [],
    };
  });
};

const CommentsTab: React.FC<CommentsTabProps> = ({
  tone,
  selectedVideo,
  user,
  isDemoMode = false,
  demoChannelTitle,
}) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [commentsDisabled, setCommentsDisabled] = useState(false);

  const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);
  const displayLimitRef = useRef<number>(randomBetween(DISPLAY_MIN, DISPLAY_MAX));

  const seedSuggestedReplies = useCallback(
    async (items: CommentType[], signal?: AbortSignal): Promise<CommentType[]> => {
      const seeded = await Promise.all(
        items.map(async (comment) => {
          if (signal?.aborted) {
            return comment;
          }
          const existing = comment.suggestedReply?.trim();
          if (existing) {
            return {
              ...comment,
              suggestedReply: existing,
            };
          }
          try {
            const generated = await generateReplyPreview(comment, tone, {
              videoTitle: selectedVideo?.title ?? null,
              isDemo: isDemoMode,
            });
            if (signal?.aborted) {
              return comment;
            }
            return {
              ...comment,
              suggestedReply: generated,
            };
          } catch (error) {
            console.warn('[comments] failed to seed reply', error);
            return {
              ...comment,
              suggestedReply: comment.suggestedReply ?? '',
            };
          }
        })
      );
      return seeded;
    },
    [isDemoMode, selectedVideo?.title, tone]
  );

  const enforceDisplayLimit = useCallback(
    (items: CommentType[]) => {
      const limit = displayLimitRef.current;
      if (items.length <= limit) {
        return items;
      }
      return items
        .map((comment) => ({ comment, sortKey: Math.random() }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .slice(0, limit)
        .map(({ comment }) => comment);
    },
    []
  );

  useEffect(() => {
    setRegenerateError(null);
    setCommentErrors({});
  }, [selectedVideo?.id]);

  useEffect(() => {
    displayLimitRef.current = randomBetween(DISPLAY_MIN, DISPLAY_MAX);
  }, [isDemoMode, selectedVideo?.id]);

  const loadComments = useCallback(
    async (signal?: AbortSignal) => {
      const videoId = selectedVideo?.id;

      if (!videoId && !isDemoMode) {
        setComments([]);
        setError(null);
        setIsLoading(false);
        setCommentErrors({});
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let normalized: CommentType[] = [];

        if (isDemoMode) {
          normalized = pickDemoComments(displayLimitRef.current);
        } else if (videoId) {
          const response = await fetch(
            `${apiBaseUrl}/retrieve-comments?videoId=${encodeURIComponent(videoId)}`,
            {
              credentials: 'include',
              signal,
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
          normalized = fetched.map((comment) => {
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
            const autoReplyId = creatorReply?.id ?? comment.autoReplyId ?? null;

            return {
              ...comment,
              text: sanitizedText,
              replies,
              sentiment,
              risk,
              suggestedReply,
              status,
              autoReplyId,
            } as CommentType;
          });
        }

        const limited = enforceDisplayLimit(normalized);
        const seeded = await seedSuggestedReplies(limited, signal);
        if (signal?.aborted) {
          return;
        }

        setComments(seeded);
        setCommentErrors({});
        setCommentsDisabled(false);
      } catch (err) {
        if (signal?.aborted) {
          return;
        }
        console.error('[comments] failed to load', err);
        const message = err instanceof Error ? err.message : 'Failed to load comments';
        const disabled =
          typeof message === 'string' &&
          (message.includes('commentsDisabled') || message.toLowerCase().includes('disabled comments'));
        if (disabled) {
          setComments([]);
          setError(null);
          setCommentsDisabled(true);
        } else {
          setComments([]);
          setError(message);
          setCommentsDisabled(false);
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [apiBaseUrl, enforceDisplayLimit, isDemoMode, seedSuggestedReplies, selectedVideo?.id, user?.channelId]
  );

  useEffect(() => {
    const controller = new AbortController();

    loadComments(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadComments]);

  const updateComment = useCallback(
    (id: string, updater: (comment: CommentType) => CommentType) => {
      setComments((prev) => prev.map((comment) => (comment.id === id ? updater(comment) : comment)));
    },
    [],
  );

  const updateSuggestedReply = useCallback(
    (id: string, text: string) => {
      updateComment(id, (comment) => ({ ...comment, suggestedReply: text }));
    },
    [updateComment],
  );

  const setCommentError = useCallback((id: string, message: string | null) => {
    setCommentErrors((prev) => {
      const next = { ...prev };
      if (message && message.length > 0) {
        next[id] = message;
      } else {
        delete next[id];
      }
      return next;
    });
  }, []);

  const handleRegenerate = async (comment: CommentType) => {
    setRegenerateError(null);
    setIsRegenerating(comment.id);

    try {
      const newReply = isDemoMode
        ? await generateReplyPreview(comment, tone, {
            videoTitle: selectedVideo?.title ?? null,
            isDemo: true,
          })
        : await regenerateReply(comment, tone, { videoTitle: selectedVideo?.title });
      updateSuggestedReply(comment.id, newReply);
    } catch (err) {
      console.error('[comments] regenerate failed', err);
      const message = err instanceof Error ? err.message : 'Failed to regenerate reply';
      setRegenerateError(message);
    } finally {
      setIsRegenerating(null);
    }
  };

  const handleApproveAndPost = async (comment: CommentType) => {
    const trimmedReply = comment.suggestedReply?.trim() ?? '';
    if (!trimmedReply) {
      setCommentError(comment.id, 'Add a reply before posting.');
      return;
    }

    if (postingCommentId === comment.id || deletingCommentId === comment.id) {
      return;
    }

    setCommentError(comment.id, null);
    setPostingCommentId(comment.id);

    try {
      if (isDemoMode) {
        await wait(450);
        updateComment(comment.id, (prev) => ({
          ...prev,
          status: 'auto-replied',
          autoReplyId: prev.autoReplyId ?? `demo-reply-${prev.id}`,
          suggestedReply: trimmedReply,
        }));
      } else {
        const response = await fetch(`${apiBaseUrl}/comments/respond`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            responses: {
              [comment.id]: trimmedReply,
            },
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
              ? payload.error
              : `Failed to post reply (status ${response.status})`;
          throw new Error(message);
        }

        const successes: Array<{ commentId?: string; replyId?: string | null; responseText?: string }> =
          Array.isArray(payload?.successes) ? payload.successes : [];
        const successEntry = successes.find((entry) => entry?.commentId === comment.id);

        if (!successEntry) {
          const failures: Array<{ commentId?: string; error?: string }> = Array.isArray(payload?.failures)
            ? payload.failures
            : [];
          const failureEntry = failures.find((entry) => entry?.commentId === comment.id);
          const failureMessage = failureEntry?.error ?? 'Failed to post reply';
          throw new Error(failureMessage);
        }

        updateComment(comment.id, (prev) => ({
          ...prev,
          status: 'auto-replied',
          autoReplyId: successEntry.replyId ?? prev.autoReplyId ?? null,
          suggestedReply: trimmedReply,
        }));
      }
    } catch (err) {
      console.error('[comments] failed to post reply', err);
      const message = err instanceof Error ? err.message : 'Failed to post reply';
      setCommentError(comment.id, message);
    } finally {
      setPostingCommentId(null);
    }
  };

  const handleUndoAutoReply = async (comment: CommentType) => {
    if (!comment.autoReplyId) {
      setCommentError(comment.id, 'Reply is still being posted. Try again in a moment.');
      return;
    }

    if (deletingCommentId === comment.id || postingCommentId === comment.id) {
      return;
    }

    setCommentError(comment.id, null);
    setDeletingCommentId(comment.id);

    try {
      if (isDemoMode) {
        await wait(350);
        updateComment(comment.id, (prev) => ({
          ...prev,
          status: 'pending',
          autoReplyId: null,
        }));
      } else {
        const response = await fetch(`${apiBaseUrl}/comments/${encodeURIComponent(comment.autoReplyId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
              ? payload.error
              : `Failed to delete reply (status ${response.status})`;
          throw new Error(message);
        }

        updateComment(comment.id, (prev) => ({
          ...prev,
          status: 'pending',
          autoReplyId: null,
        }));
      }
    } catch (err) {
      console.error('[comments] failed to delete reply', err);
      const message = err instanceof Error ? err.message : 'Failed to undo auto-reply';
      setCommentError(comment.id, message);
    } finally {
      setDeletingCommentId(null);
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
    if (!selectedVideo?.id && !isDemoMode) {
      return <p className="text-sm text-white/60">Select a video from the sidebar to review its comments.</p>;
    }
    if (isLoading) {
      return (
        <div className="flex items-center gap-3 text-sm text-white/60" role="status" aria-live="polite">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
          <span>Loading comments from YouTube…</span>
        </div>
      );
    }
    if (commentsDisabled) {
      return (
        <p className="text-sm text-white/60">
          Comments are disabled for this video. Choose another upload to see community engagement.
        </p>
      );
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
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
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
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-100 shadow-inner shadow-emerald-500/25">
                          <span className="text-emerald-300/90">Risk</span>
                          <span className="capitalize text-white">{comment.risk}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-sky-100 shadow-inner shadow-sky-500/25">
                          <span className="text-sky-300/90">Tone</span>
                          <span className="capitalize text-white">{comment.sentiment}</span>
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/10">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                        AI Reply (Posted)
                      </label>
                      <p className="text-sm text-white/80">{comment.suggestedReply}</p>
                    </div>
                    <div className="mt-3 flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleUndoAutoReply(comment)}
                        disabled={deletingCommentId === comment.id || postingCommentId === comment.id}
                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingCommentId === comment.id ? 'Deleting…' : 'Undo Auto-Reply'}
                      </button>
                      {commentErrors[comment.id] && (
                        <p className="text-xs text-rose-300">{commentErrors[comment.id]}</p>
                      )}
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
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70 shadow-inner shadow-white/10">
                          <span className="text-indigo-200/90">Risk</span>
                          <span className="capitalize text-white/90">{comment.risk}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70 shadow-inner shadow-white/10">
                          <span className="text-indigo-200/90">Tone</span>
                          <span className="capitalize text-white/90">{comment.sentiment}</span>
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
                          onChange={(event) => {
                            setCommentError(comment.id, null);
                            updateSuggestedReply(comment.id, event.target.value);
                          }}
                          className="h-24 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                        />
                      </div>
                      <div className="col-span-12 flex flex-row gap-2 md:col-span-3 md:flex-col">
                        <button
                          onClick={() => handleApproveAndPost(comment)}
                          disabled={
                            postingCommentId === comment.id ||
                            deletingCommentId === comment.id ||
                            !(comment.suggestedReply && comment.suggestedReply.trim().length > 0)
                          }
                          className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                            postingCommentId === comment.id
                              ? 'cursor-wait border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-[0_12px_30px_rgba(16,185,129,0.25)]'
                              : deletingCommentId === comment.id || !(comment.suggestedReply && comment.suggestedReply.trim().length > 0)
                                ? 'cursor-not-allowed border border-white/15 bg-white/10 text-white/50'
                                : 'border border-white/20 bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 text-white shadow-[0_20px_45px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(99,102,241,0.45)]'
                          }`}
                        >
                          {postingCommentId === comment.id ? 'Posting…' : 'Approve & Post'}
                        </button>
                        <button
                          onClick={() => handleRegenerate(comment)}
                          disabled={
                            isRegenerating === comment.id ||
                            postingCommentId === comment.id ||
                            deletingCommentId === comment.id
                          }
                          className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isRegenerating === comment.id ? 'Thinking…' : 'Regenerate'}
                        </button>
                      </div>
                    </div>
                    {commentErrors[comment.id] && (
                      <p className="mt-2 text-xs text-rose-300">{commentErrors[comment.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default CommentsTab;

const LoadingSkeleton: React.FC = () => (
  <>
    <div>
      <div className="mb-4 flex items-center gap-3 text-indigo-200">
        <span className="opacity-40">
          <RobotIcon />
        </span>
        <h3 className="text-lg font-semibold text-white">Auto-Replied by AI</h3>
      </div>
      <div className="space-y-4" aria-hidden="true">
        <div className="animate-pulse rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 shadow-inner shadow-emerald-500/10">
          <div className="mb-3 flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded-full bg-white/20" />
              <div className="h-3 w-56 rounded-full bg-white/10" />
              <div className="h-3 w-48 rounded-full bg-white/10" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-white/10" />
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/10">
            <div className="h-3 w-36 rounded-full bg-white/15" />
            <div className="mt-2 h-3 w-full rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-3/4 rounded-full bg-white/10" />
          </div>
          <div className="mt-3 flex justify-end">
            <div className="h-8 w-32 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>

    <div>
      <div className="mb-4 flex items-center gap-3 text-white/70">
        <span className="opacity-40">
          <InboxIcon />
        </span>
        <h3 className="text-lg font-semibold text-white">For Your Review</h3>
      </div>
      <div className="space-y-4" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-white/5"
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-3 w-40 rounded-full bg-white/20" />
                <div className="h-3 w-full rounded-full bg-white/10" />
                <div className="h-3 w-5/6 rounded-full bg-white/10" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-white/10" />
                <div className="h-6 w-20 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 items-end gap-3 md:grid-cols-12">
              <div className="col-span-12 md:col-span-9 space-y-3">
                <div className="h-3 w-40 rounded-full bg-white/15" />
                <div className="h-24 w-full rounded-2xl border border-white/10 bg-white/5" />
              </div>
              <div className="col-span-12 flex flex-row gap-2 md:col-span-3 md:flex-col">
                <div className="h-10 w-full rounded-full bg-white/10" />
                <div className="h-10 w-full rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);


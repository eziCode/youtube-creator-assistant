import React, { useState, useMemo } from 'react';
import { Comment, Tone, CommentStatus } from '../types';
import { MOCK_COMMENTS } from '../constants';
import { regenerateReply } from '../services/geminiService';
import { RobotIcon, InboxIcon } from './icons';
import {
  AuthenticatedUser,
  Comment,
  CommentStatus,
  RiskLevel,
  Sentiment,
  Tone,
  Video,
} from '../types';

interface CommentsTabProps {
  tone: Tone;
  selectedVideo: Video | null;
  user: AuthenticatedUser | null;
}

const CommentsTab: React.FC<CommentsTabProps> = ({ tone }) => {
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null);

const inferSentiment = (text: string): Sentiment => {
  const lower = text.toLowerCase();
  if (!lower) return 'neutral';

  const questionWords = ['?', 'who', 'what', 'when', 'where', 'why', 'how', 'can you'];
  if (questionWords.some(word => lower.includes(word))) {
    return 'question';
  }

  const negativeWords = ['hate', 'bad', 'terrible', 'awful', 'issue', 'problem', 'hard', 'difficult', 'confusing'];
  if (negativeWords.some(word => lower.includes(word))) {
    return 'negative';
  }

  const positiveWords = ['love', 'great', 'awesome', 'amazing', 'good', 'helpful', 'thanks', 'thank you'];
  if (positiveWords.some(word => lower.includes(word))) {
    return 'positive';
  }

  return 'neutral';
};

const deriveRisk = (sentiment: Sentiment): RiskLevel =>
  sentiment === 'negative' || sentiment === 'question' ? 'high' : 'low';

const CommentsTab: React.FC<CommentsTabProps> = ({ tone, selectedVideo, user }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
	const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
	const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const apiBaseUrl = useMemo(() => API_BASE_URL.replace(/\/$/, ''), []);

	useEffect(() => {
		setRegenerateError(null);
	}, [selectedVideo?.id, refreshIndex]);

  useEffect(() => {
    if (!selectedVideo?.id) {
      setComments([]);
      setError('Select a video from the sidebar to load comments.');
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
        const fetchedComments: Comment[] = Array.isArray(payload?.comments) ? payload.comments : [];
        const normalizedComments = fetchedComments.map((comment) => {
          const baseReplies = Array.isArray(comment.replies) ? comment.replies : [];
          const replies = baseReplies.map((reply) => ({
            ...reply,
            text: stripHtml(reply.text),
          }));
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
          };
        });

        setComments(normalizedComments);
        setLastUpdated(new Date());
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('[comments] failed to load comments', err);
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
  }, [apiBaseUrl, selectedVideo?.id, refreshIndex, user?.channelId]);

  const setCommentStatus = (id: string, status: CommentStatus) => {
    setComments(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));
  };

  const updateSuggestedReply = (id: string, text: string) => {
    setComments(prev => prev.map(c => (c.id === id ? { ...c, suggestedReply: text } : c)));
  };
  
	const handleRegenerate = async (comment: Comment) => {
		setRegenerateError(null);
		setIsRegenerating(comment.id);
		try {
			const newReply = await regenerateReply(comment, tone, { videoTitle: selectedVideo?.title });
			updateSuggestedReply(comment.id, newReply);
		} catch (err) {
			console.error('[comments] failed to regenerate reply', err);
			const message = err instanceof Error ? err.message : 'Failed to regenerate reply';
			setRegenerateError(message);
		} finally {
			setIsRegenerating(null);
		}
	};

  const { needsReviewComments, autoRepliedComments } = useMemo(() => {
    return comments.reduce((acc, comment) => {
      if (comment.status === 'auto-replied') {
        acc.autoRepliedComments.push(comment);
      } else {
        acc.needsReviewComments.push(comment);
      }
      return acc;
    }, { needsReviewComments: [] as Comment[], autoRepliedComments: [] as Comment[] });
  }, [comments]);

  const refreshComments = () => {
    setRefreshIndex(prev => prev + 1);
  };

  const renderStatusMessage = () => {
    if (!selectedVideo?.id) {
      return <p className="text-sm text-slate-500">Select a video from the sidebar to review its comments.</p>;
    }

    if (isLoading) {
      return <p className="text-sm text-slate-500">Loading comments from YouTube…</p>;
    }

    if (error) {
      return <p className="text-sm text-rose-600">{error}</p>;
    }

    if (!comments.length) {
      return <p className="text-sm text-slate-500">No comments were found for this video. Try refreshing in a bit.</p>;
    }

    return null;
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
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

		<div className="mb-4 space-y-2">
			{renderStatusMessage()}
			{regenerateError && (
				<p className="text-sm text-rose-600">{regenerateError}</p>
			)}
		</div>

      <div className="space-y-8">
        {/* === AUTO-REPLIED SECTION === */}
        <div>
          <div className="mb-4 flex items-center gap-3 text-indigo-200">
              <RobotIcon />
              <h3 className="text-lg font-semibold text-white">Auto-Replied by AI ({autoRepliedComments.length})</h3>
          </div>
          <div className="space-y-4">
            {autoRepliedComments.length === 0 && <p className="pl-8 text-sm text-white/60">No comments have been auto-replied to yet.</p>}
            {autoRepliedComments.map(c => (
              <div key={c.id} className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-inner shadow-emerald-500/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{c.user}</div>
                    <p className="mt-1 text-sm text-white/80">{c.text}</p>
                  </div>
                   <div className="flex gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize border border-white/15 bg-white/10 text-white/70`}>{c.risk} Risk</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize border border-white/15 bg-white/10 text-white/70`}>{c.sentiment}</span>
                   </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/10">
                   <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-white/50">AI Reply (Posted)</label>
                   <p className="text-sm text-white/80">{c.suggestedReply}</p>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => setCommentStatus(c.id, 'pending')} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white">
                      Undo Auto-Reply
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === FOR REVIEW SECTION === */}
        <div>
           <div className="mb-4 flex items-center gap-3 text-white/70">
              <InboxIcon />
              <h3 className="text-lg font-semibold text-white">For Your Review ({needsReviewComments.length})</h3>
            </div>
          <div className="space-y-4">
          {needsReviewComments.length === 0 && <p className="pl-8 text-sm text-white/60">Your review queue is empty. Great job!</p>}
            {needsReviewComments.map(c => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{c.user}</div>
                    <p className="mt-1 text-sm text-white/80">{c.text}</p>
                  </div>
                   <div className="flex gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize border border-white/15 bg-white/10 text-white/70`}>{c.risk} Risk</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize border border-white/15 bg-white/10 text-white/70`}>{c.sentiment}</span>
                   </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 md:col-span-9">
                      <label htmlFor={`reply-${c.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-white/50">AI-Suggested Reply</label>
                      <textarea id={`reply-${c.id}`} value={c.suggestedReply} onChange={(e) => updateSuggestedReply(c.id, e.target.value)} className="h-24 w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white/80 shadow-inner shadow-black/40 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"/>
                  </div>
                  <div className="col-span-12 md:col-span-3 flex flex-row md:flex-col gap-2">
                    <button onClick={() => setCommentStatus(c.id, 'approved')} disabled={c.status === 'approved'} className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                        c.status === 'approved' 
                          ? 'cursor-default border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-[0_12px_30px_rgba(16,185,129,0.25)]' 
                          : 'border border-white/20 bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 text-white shadow-[0_20px_45px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(99,102,241,0.45)]'
                      }`}>
                      {c.status === 'approved' ? '✓ Approved' : 'Approve & Post'}
                    </button>
                    <button onClick={() => handleRegenerate(c)} disabled={isRegenerating === c.id} className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-wait disabled:opacity-50">
                      {isRegenerating === c.id ? 'Thinking...' : 'Regenerate'}
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

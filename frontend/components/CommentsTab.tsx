import React, { useState, useMemo, useEffect } from 'react';
import { API_BASE_URL } from '../constants';
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

const sentimentStyles: Record<Sentiment, string> = {
  positive: 'bg-emerald-100 text-emerald-800',
  negative: 'bg-rose-100 text-rose-800',
  question: 'bg-sky-100 text-sky-800',
  neutral: 'bg-slate-200 text-slate-800',
};

const riskStyles: { [key in RiskLevel]: string } = {
  low: 'bg-slate-200 text-slate-800',
  high: 'bg-amber-100 text-amber-800',
};

const stripHtml = (value?: string | null) =>
  (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

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
    <section>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-800">Comments & Replies</h2>
        <div className="flex flex-col md:items-end gap-1 text-sm text-slate-500">
          {selectedVideo?.title && (
            <span className="text-slate-600">
              Reviewing: <strong className="text-slate-800">{selectedVideo.title}</strong>
            </span>
          )}
          <span>
            Current Tone: <strong className="text-indigo-600">{tone}</strong>
          </span>
          {lastUpdated && !isLoading && (
            <span className="text-xs text-slate-400">
              Last synced {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshComments}
            disabled={isLoading || !selectedVideo?.id}
            className="px-3 py-2 text-sm font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
          >
            Refresh comments
          </button>
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
          <div className="flex items-center text-indigo-700 mb-3">
              <RobotIcon />
              <h3 className="text-base font-semibold">Auto-Replied by AI ({autoRepliedComments.length})</h3>
          </div>
          <div className="space-y-4">
            {autoRepliedComments.length === 0 && <p className="text-sm text-slate-500 pl-8">No comments have been auto-replied to yet.</p>}
            {autoRepliedComments.map(c => (
              <div key={c.id} className="p-4 bg-emerald-50 border-l-4 border-emerald-300 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{c.author?.displayName ?? 'Viewer'}</div>
                    {c.publishedAt && (
                      <p className="text-xs text-slate-500">{formatTimestamp(c.publishedAt)}</p>
                    )}
                    <p className="text-sm text-slate-700 mt-1">{c.text}</p>
                  </div>
                   <div className="flex gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${riskStyles[c.risk ?? 'low']}`}>{c.risk ?? 'low'} Risk</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${sentimentStyles[c.sentiment ?? 'neutral']}`}>{c.sentiment ?? 'neutral'}</span>
                   </div>
                </div>
                <div className="mt-4 p-3 bg-white rounded-md">
                   <label className="block text-xs font-medium text-slate-600 mb-1">AI Reply (Posted)</label>
                   <p className="text-sm text-slate-800">{c.suggestedReply ?? 'Reply unavailable'}</p>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => setCommentStatus(c.id, 'pending')} className="py-1 px-3 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100">Undo Auto-Reply</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === FOR REVIEW SECTION === */}
        <div>
           <div className="flex items-center text-slate-700 mb-3">
              <InboxIcon />
              <h3 className="text-base font-semibold">For Your Review ({needsReviewComments.length})</h3>
            </div>
          <div className="space-y-4">
          {needsReviewComments.length === 0 && <p className="text-sm text-slate-500 pl-8">Your review queue is empty. Great job!</p>}
            {needsReviewComments.map(c => (
              <div key={c.id} className="p-4 bg-slate-50 rounded-lg transition-shadow hover:shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{c.author?.displayName ?? 'Viewer'}</div>
                    {c.publishedAt && (
                      <p className="text-xs text-slate-500">{formatTimestamp(c.publishedAt)}</p>
                    )}
                    <p className="text-sm text-slate-700 mt-1">{c.text}</p>
                  </div>
                   <div className="flex gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${riskStyles[c.risk ?? 'low']}`}>{c.risk ?? 'low'} Risk</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${sentimentStyles[c.sentiment ?? 'neutral']}`}>{c.sentiment ?? 'neutral'}</span>
                   </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 md:col-span-9">
                      <label htmlFor={`reply-${c.id}`} className="block text-xs font-medium text-slate-600 mb-1">AI-Suggested Reply</label>
                      <textarea id={`reply-${c.id}`} value={c.suggestedReply ?? ''} onChange={(e) => updateSuggestedReply(c.id, e.target.value)} className="w-full p-2 border border-slate-300 rounded-md shadow-sm h-24 text-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
                  <div className="col-span-12 md:col-span-3 flex flex-row md:flex-col gap-2">
                    <button onClick={() => setCommentStatus(c.id, 'approved')} disabled={c.status === 'approved'} className={`w-full py-2 px-3 text-sm font-semibold rounded-md transition-all duration-200 ${
                        c.status === 'approved' 
                          ? 'bg-emerald-600 text-white cursor-default' 
                          : 'bg-white border border-slate-300 hover:bg-slate-100'
                      }`}>
                      {c.status === 'approved' ? '✓ Approved' : 'Approve & Post'}
                    </button>
                    <button onClick={() => handleRegenerate(c)} disabled={isRegenerating === c.id} className="w-full py-2 px-3 text-sm font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-wait">
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

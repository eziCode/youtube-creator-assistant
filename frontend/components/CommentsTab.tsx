import React, { useState, useMemo } from 'react';
import { Comment, Tone, CommentStatus } from '../types';
import { MOCK_COMMENTS } from '../constants';
import { regenerateReply } from '../services/geminiService';
import { RobotIcon, InboxIcon } from './icons';

interface CommentsTabProps {
  tone: Tone;
}

const CommentsTab: React.FC<CommentsTabProps> = ({ tone }) => {
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null);

  const setCommentStatus = (id: number, status: CommentStatus) => {
    setComments(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));
  };

  const updateSuggestedReply = (id: number, text: string) => {
    setComments(prev => prev.map(c => (c.id === id ? { ...c, suggestedReply: text } : c)));
  };
  
  const handleRegenerate = async (comment: Comment) => {
    setIsRegenerating(comment.id);
    const newReply = await regenerateReply(comment, tone);
    updateSuggestedReply(comment.id, newReply);
    setIsRegenerating(null);
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

import React, { useState, useMemo } from 'react';
import { Comment, Tone, Sentiment, RiskLevel, CommentStatus } from '../types';
import { MOCK_COMMENTS } from '../constants';
import { regenerateReply } from '../services/geminiService';
import { RobotIcon, InboxIcon } from './icons';

interface CommentsTabProps {
  tone: Tone;
}

const sentimentStyles: { [key in Sentiment]: string } = {
  positive: 'bg-emerald-100 text-emerald-800',
  negative: 'bg-rose-100 text-rose-800',
  question: 'bg-sky-100 text-sky-800',
};

const riskStyles: { [key in RiskLevel]: string } = {
  low: 'bg-slate-200 text-slate-800',
  high: 'bg-amber-100 text-amber-800',
};

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
    <section>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Comments & Replies</h2>
        <div className="text-sm text-slate-500">Current Tone: <strong className="text-indigo-600">{tone}</strong></div>
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
                    <div className="text-sm font-semibold text-slate-800">{c.user}</div>
                    <p className="text-sm text-slate-700 mt-1">{c.text}</p>
                  </div>
                   <div className="flex gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${riskStyles[c.risk]}`}>{c.risk} Risk</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${sentimentStyles[c.sentiment]}`}>{c.sentiment}</span>
                   </div>
                </div>
                <div className="mt-4 p-3 bg-white rounded-md">
                   <label className="block text-xs font-medium text-slate-600 mb-1">AI Reply (Posted)</label>
                   <p className="text-sm text-slate-800">{c.suggestedReply}</p>
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
                    <div className="text-sm font-semibold text-slate-800">{c.user}</div>
                    <p className="text-sm text-slate-700 mt-1">{c.text}</p>
                  </div>
                   <div className="flex gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${riskStyles[c.risk]}`}>{c.risk} Risk</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${sentimentStyles[c.sentiment]}`}>{c.sentiment}</span>
                   </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 md:col-span-9">
                      <label htmlFor={`reply-${c.id}`} className="block text-xs font-medium text-slate-600 mb-1">AI-Suggested Reply</label>
                      <textarea id={`reply-${c.id}`} value={c.suggestedReply} onChange={(e) => updateSuggestedReply(c.id, e.target.value)} className="w-full p-2 border border-slate-300 rounded-md shadow-sm h-24 text-sm focus:ring-indigo-500 focus:border-indigo-500"/>
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

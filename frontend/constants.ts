import { Video, Comment } from './types';

export const MOCK_VIDEOS: Video[] = [
  { id: "v1", title: "Why React Still Dominates in 2025", views: 41230, watchTime: 5200, retention: 0.62, likes: 2400, commentsCount: 120 },
  { id: "v2", title: "Top 10 JS Tips in 10 Minutes", views: 33210, watchTime: 4100, retention: 0.55, likes: 1800, commentsCount: 90 },
  { id: "v3", title: "Full-Stack Project Walkthrough", views: 27500, watchTime: 6200, retention: 0.67, likes: 1500, commentsCount: 110 },
  { id: "v4", title: "Interview Prep: System Design", views: 18700, watchTime: 3000, retention: 0.48, likes: 900, commentsCount: 60 },
  { id: "v5", title: "Speedrun: Build a Todo App", views: 51200, watchTime: 7000, retention: 0.72, likes: 4200, commentsCount: 210 }
];

export const MOCK_COMMENTS: Comment[] = [
  // This comment is positive and low-risk, so it gets auto-replied.
  { 
    id: 1, 
    user: "AlexDev", 
    text: "This helped me a lot, thanks! The explanation at 5:32 was crystal clear.", 
    sentiment: "positive", 
    risk: "low",
    suggestedReply: "I'm so glad it helped, Alex! Happy to hear that part was useful for you. Keep up the great work!", 
    status: "auto-replied" 
  },
  // This comment is negative, therefore high-risk. It needs manual review.
  { 
    id: 2, 
    user: "DanaCritiques", 
    text: "You talk too fast and the audio quality is a bit low. Hard to follow sometimes.", 
    sentiment: "negative", 
    risk: "high",
    suggestedReply: "Thanks for the honest feedback, Dana. I'll work on my pacing and look into upgrading my microphone for future videos.", 
    status: "pending"
  },
  // This is a question, which we'll classify as high-risk to ensure accuracy. Needs manual review.
  { 
    id: 3, 
    user: "SamLearns", 
    text: "Can you share the GitHub repo for this project?", 
    sentiment: "question", 
    risk: "high",
    suggestedReply: "Absolutely! The link to the full source code is in the video description. Let me know if you have any questions!", 
    status: "pending" 
  },
  // This comment is positive, but let's say the AI flags it as high-risk (e.g., contains a brand name). Needs manual review.
  {
    id: 4,
    user: "TechReviewer",
    text: "Great content! Have you considered doing a comparison with Vue?",
    sentiment: "positive",
    risk: "high",
    suggestedReply: "That's a fantastic idea! I'll add a Vue comparison to my list of upcoming videos. Thanks for the suggestion!",
    status: "pending"
  }
];

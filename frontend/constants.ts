import { Comment } from './types';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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

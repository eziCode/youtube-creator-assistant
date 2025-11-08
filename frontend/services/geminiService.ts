import { API_BASE_URL } from '../constants';
import { Video, Tone, Comment } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const apiBaseUrl = API_BASE_URL.replace(/\/$/, '');

/**
 * MOCK API: Generates AI-powered insights for a set of videos.
 * In a real app, this would call the Gemini API with video metadata
 * to get performance analysis and suggestions.
 */
export const generateAiInsights = async (videos: Video[]): Promise<string> => {
  console.log("Mock API Call: generateAiInsights");
  await delay(800);
  // Real implementation:
  // const prompt = `Analyze these YouTube video stats and provide actionable insights for the creator: ${JSON.stringify(videos, null, 2)}. Focus on themes, video length, and retention.`;
  // const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  // return response.text;
  return `• Videos with "Tips" or short titles (< 30 chars) show higher engagement.\n• Your average retention is strong at 62%, but dips on videos over 10 minutes.\n• Suggestion: Create a short-form "JS Tips" video (< 3 mins) to capitalize on the high-performing format.`;
};

/**
 * MOCK API: Generates a reply to a comment in a specific tone.
 * In a real app, this would call the Gemini API.
 */
interface RegenerateReplyOptions {
  videoTitle?: string | null;
}

export const regenerateReply = async (comment: Comment, tone: Tone, options?: RegenerateReplyOptions): Promise<string> => {
  const response = await fetch(`${apiBaseUrl}/comments/generate-reply`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      commentText: comment.text,
      tone,
      viewerName: comment.author?.displayName,
      videoTitle: options?.videoTitle,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string')
        ? payload.error
        : `Failed to generate reply (status ${response.status})`;
    throw new Error(message);
  }

  const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : '';
  if (!reply) {
    throw new Error('No reply returned from assistant');
  }

  return reply;
};

/**
 * MOCK API: Analyzes a video transcript to find engaging clips for shorts.
 * In a real app, you would upload the video, get it transcribed (e.g., using Whisper),
 * and then send the transcript to Gemini for analysis.
 */
export const findShortsHighlights = async (videoFile: File): Promise<{ start: number, end: number, reason: string }[]> => {
  console.log("Mock API Call: findShortsHighlights for file:", videoFile.name);
  await delay(1500);
  // Real implementation:
  // 1. Upload videoFile to a server.
  // 2. Transcribe the video audio to text.
  // 3. Send transcript to Gemini with a prompt like:
  //    "From this video transcript, identify 3 key moments that would make great YouTube Shorts. Look for strong hooks, emotional peaks, or concise, valuable tips. Provide start/end timestamps and a brief reason for each."
  // 4. Parse the Gemini response to get the clips.
  return [
    { start: 12, end: 27, reason: "Strong audio emphasis + visual motion" },
    { start: 88, end: 103, reason: "Audience callout + concise hook" },
    { start: 154, end: 168, reason: "Final key takeaway is summarized here." }
  ];
};

/**
 * MOCK API: Simulates an export job for a video clip.
 * In a real app, this would trigger a backend process (e.g., using FFmpeg) to cut the video.
 */
export const exportShort = async (clipIndex: number): Promise<string> => {
  console.log("Mock API Call: exportShort for clip:", clipIndex);
  await delay(2000);
  return `Export complete! short_clip_${clipIndex + 1}.mp4 is ready.`;
};

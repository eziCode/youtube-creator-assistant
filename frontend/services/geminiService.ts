import { API_BASE_URL } from '../constants';
import { Video, Tone, Comment, Sentiment } from '../types';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const apiBaseUrl = API_BASE_URL.replace(/\/$/, '');

const QUESTION_TOKENS = ['?', 'who', 'what', 'when', 'where', 'why', 'how', 'can you'];
const NEGATIVE_TOKENS = ['hate', 'bad', 'terrible', 'awful', 'issue', 'problem', 'hard', 'difficult', 'confusing'];
const POSITIVE_TOKENS = ['love', 'great', 'awesome', 'amazing', 'good', 'helpful', 'thanks', 'thank you', 'incredible', 'fire'];

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatName = (value?: string | null) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const [first] = trimmed.split(/\s+/);
  return first ?? '';
};

const detectSentiment = (text: string | null | undefined): Sentiment => {
  if (!text) {
    return 'neutral';
  }
  const lower = text.toLowerCase();
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

type ReplyMood = Sentiment;

const TONE_LIBRARY: Record<Tone, Record<ReplyMood | 'default', string[]>> = {
  Friendly: {
    positive: [
      'Appreciate you sharing this, {name}',
      'Love this energy, {name}',
      'So glad this landed',
    ],
    negative: [
      'Totally hear you, fixing this asap',
      'Got you, smoothing that out',
      'Fair callout, adjusting now',
    ],
    question: [
      'Happy to dig into that',
      'Let me break that down quickly',
      'Great cue, covering that next',
    ],
    neutral: [
      'Noted for the next upload',
      'Adding this to our brainstorm',
      'Flagged for the next drop',
    ],
    default: ['On it, thanks for flagging'],
  },
  Professional: {
    positive: [
      'Great to see this resonated',
      'Encouraging signal from you',
      'Appreciate the positive data point',
    ],
    negative: [
      'Understood, lining up a fix',
      'Great catch, addressing this soon',
      'Recording this for the next pass',
    ],
    question: [
      "I'll follow up with specifics shortly",
      'Documenting that for the walkthrough',
      'Circling back on that in detail',
    ],
    neutral: [
      'Logging this for our next review',
      'Appreciate the context here',
      'Capturing this insight internally',
    ],
    default: ['Thanks for the insight'],
  },
  Comedic: {
    positive: [
      'Your hype is contagious',
      'This made my day, legit',
      'Vibes completely matched',
    ],
    negative: [
      'Oof, fair roast noted',
      'Challenge accepted, tweaking soon',
      'Okay valid drag, fixing it',
    ],
    question: [
      'Let me grab the cheat sheet',
      'Answering that in the next clip',
      'Hold my coffee, researching now',
    ],
    neutral: [
      'Pinning this under spicy ideas',
      'Adding this to the blooper reel',
      'Bookmarking this brainwave',
    ],
    default: ['You get it ✨'],
  },
  Sarcastic: {
    positive: [
      'Love that spark, seriously',
      'Okay bestie, noted',
      'Fine, I’m impressed',
    ],
    negative: [
      'Bold take, but valid',
      'Alright, dragging me in the best way',
      'I hear the sass, fixing it',
    ],
    question: [
      'Let me decode that mystery',
      'Stay tuned, detective mode on',
      'Cracking that case right now',
    ],
    neutral: [
      'Obsessing over this note now',
      'Fine, I’m convinced',
      'Adding this to the chaos board',
    ],
    default: ['Say less'],
  },
};

type ToneKey = keyof typeof TONE_LIBRARY;

const KEYWORD_RESPONSES: Array<{
  keywords: string[];
  phrases: Partial<Record<ToneKey, string[]>>;
  topic: string;
}> = [
  {
    keywords: ['light', 'lighting', 'bright'],
    topic: 'lighting',
    phrases: {
      Friendly: ['Lighting tweak coming right up'],
      Professional: ['Logging a lighting adjustment'],
      Comedic: ['Lights get a glow-up next'],
      Sarcastic: ['Cool, flipping the light switch now'],
    },
  },
  {
    keywords: ['mic', 'audio', 'sound'],
    topic: 'audio',
    phrases: {
      Friendly: ['Audio polish incoming'],
      Professional: ['Queued an audio cleanup'],
      Comedic: ['Mic check glow-up saved'],
      Sarcastic: ['Fine, audio nerd mode on'],
    },
  },
  {
    keywords: ['thumbnail', 'thumb'],
    topic: 'thumbnail',
    phrases: {
      Friendly: ['Thumbnail remix on the way'],
      Professional: ['Thumbnail iteration scheduled'],
      Comedic: ['Thumbnail glow-up unlocked'],
      Sarcastic: ['Okay okay, thumbnail makeover time'],
    },
  },
  {
    keywords: ['script', 'line', 'copy'],
    topic: 'script',
    phrases: {
      Friendly: ['Script notes saved for next'],
      Professional: ['Script revision drafted'],
      Comedic: ['Script plot twist unlocked'],
      Sarcastic: ['Script chaos now contained'],
    },
  },
  {
    keywords: ['upload', 'schedule', 'posting'],
    topic: 'schedule',
    phrases: {
      Friendly: ['Scheduling tweak coming soon'],
      Professional: ['Adjusting the release cadence'],
      Comedic: ['Calendar chaos officially wrangled'],
      Sarcastic: ['Fine, I’ll talk to the calendar'],
    },
  },
  {
    keywords: ['camera', 'angle', 'shot'],
    topic: 'camera',
    phrases: {
      Friendly: ['Camera framing gets love next'],
      Professional: ['Queuing a framing adjustment'],
      Comedic: ['Camera glow-up loading'],
      Sarcastic: ['Guess we’re befriending the lens now'],
    },
  },
  {
    keywords: ['monetization', 'sponsor', 'brand'],
    topic: 'monetization',
    phrases: {
      Friendly: ['Monetization notes saved for follow-up'],
      Professional: ['Routing this to the sponsor deck'],
      Comedic: ['Ad wizard hat goes on now'],
      Sarcastic: ['Fine, money brain activated'],
    },
  },
];

const pickKeywordPhrase = (tone: ToneKey, text: string) => {
  const lower = text.toLowerCase();
  for (const entry of KEYWORD_RESPONSES) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      const options =
        entry.phrases[tone] ??
        entry.phrases.Friendly ??
        [];
      if (options.length) {
        return {
          phrase: options[randomBetween(0, options.length - 1)],
          topic: entry.topic,
        };
      }
    }
  }
  return null;
};

const applyTemplate = (template: string, context: { name?: string; topic?: string; video?: string }) => {
  let result = template;
  const replacements: Record<string, string> = {
    '{name}': context.name ?? '',
    '{topic}': context.topic ?? '',
    '{video}': context.video ?? '',
  };
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value || '');
  }
  result = result
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,!?])/g, '$1')
    .replace(/,\s*$/g, '')
    .trim();
  return result;
};

const enforceWordLimit = (phrase: string, maxWords = 12) => {
  const words = phrase.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return phrase;
  }
  return words.slice(0, maxWords).join(' ');
};

interface GenerateReplyPreviewOptions {
  videoTitle?: string | null;
  isDemo?: boolean;
}

export const generateReplyPreview = async (
  comment: Comment,
  tone: Tone,
  options: GenerateReplyPreviewOptions = {}
): Promise<string> => {
  const mood: ReplyMood = detectSentiment(comment.text);
  const toneKey: ToneKey = tone in TONE_LIBRARY ? tone : 'Friendly';
  const name = formatName(comment.author?.displayName);
  const keyword = comment.text ? pickKeywordPhrase(toneKey, comment.text) : null;
  const videoSlug = options.videoTitle?.split(/\s+/).find((word) => word && word.length > 3) ?? '';

  const candidates = new Set<string>();
  const tonePhrases = TONE_LIBRARY[toneKey];
  const moodPhrases = tonePhrases[mood] ?? [];
  moodPhrases.forEach((phrase) => candidates.add(phrase));
  tonePhrases.default.forEach((phrase) => candidates.add(phrase));

  if (keyword) {
    candidates.add(keyword.phrase);
  }

  candidates.add('Appreciate you flagging this');
  candidates.add('Noted and on my list');

  const pool = Array.from(candidates).filter(Boolean);
  const selected = pool.length ? pool[randomBetween(0, pool.length - 1)] : 'Appreciate you';

  const context = {
    name,
    topic: keyword?.topic ?? '',
    video: videoSlug ?? '',
  };

  await delay(options.isDemo ? randomBetween(100, 220) : randomBetween(60, 160));

  const phrase = applyTemplate(selected, context);
  return enforceWordLimit(phrase);
};

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
  try {
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

    return enforceWordLimit(reply);
  } catch (error) {
    console.warn('[gemini] falling back to canned reply', error);
    return generateReplyPreview(comment, tone, {
      videoTitle: options?.videoTitle ?? null,
      isDemo: true,
    });
  }
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

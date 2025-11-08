import { GoogleGenAI, Type } from "@google/genai";
import { YoutubeTranscript } from "youtube-transcript";

/**
 * Grabs the words/captions from a YouTube video with timestamps.
 */
async function getVideoTranscript(videoId) {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        return transcript.map((entry) => ({
            text: entry.text,
            startTime: entry.offset / 1000, // Convert ms to seconds
            duration: entry.duration / 1000,
        }));
    } catch (error) {
        console.error("Error fetching transcript:", error);
        throw new Error("No transcript available for this video. Please ensure captions are enabled.");
    }
}

/**
 * Analyzes a video transcript with Gemini AI to find engaging clips.
 */
async function analyzeTranscriptForShorts(transcript, videoTitle) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const formattedTranscript = transcript.map((entry) => `[${Math.floor(entry.startTime)}s] ${entry.text}`).join("\n");

    const prompt = `
You are a YouTube Shorts expert. Analyze this video transcript and identify 3-5 engaging clips that would make great YouTube Shorts (60 seconds or less).

Video Title: ${videoTitle}

Transcript:
${formattedTranscript}

For each potential short, provide:
1. Start time (in seconds)
2. End time (in seconds)
3. A catchy title for the short
4. Why this clip would perform well as a short
5. Suggested hook (first 3 seconds text overlay)

Return your response as a JSON array.`;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                startTime: { type: Type.NUMBER, description: "The start time of the clip in seconds." },
                endTime: { type: Type.NUMBER, description: "The end time of the clip in seconds." },
                title: { type: Type.STRING, description: "A catchy title for the short video." },
                reason: { type: Type.STRING, description: "Why this clip would perform well as a short." },
                hook: { type: Type.STRING, description: "A suggested hook for the first 3 seconds (text overlay)." },
            },
            required: ["startTime", "endTime", "title", "reason", "hook"],
        },
    };

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = result.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error analyzing video with Gemini:", error);
        throw new Error("Failed to analyze video transcript with AI.");
    }
}

/**
 * Main function that ties everything together.
 */
export async function generateShortsIdeas(videoId, videoTitle) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }
    const transcript = await getVideoTranscript(videoId);
    if (!transcript || transcript.length === 0) {
        return [];
    }
    const ideas = await analyzeTranscriptForShorts(transcript, videoTitle);
    return ideas;
}
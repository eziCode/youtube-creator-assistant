import axios from "axios";
import OpenAI from "openai";
import { google } from "googleapis";
import { buildOAuthClient } from "../../utils/googleOAuthClient.js";
import Transcript from "../../src/models/Transcript.js";

const MIN_SHORT_DURATION = 30;
const MAX_SHORT_DURATION = 55;
const MAX_IDEAS = 7;
const MIN_LONG_VIDEO_IDEAS = 5;
const LONG_VIDEO_THRESHOLD_SECONDS = 240;
const DEFAULT_LANGUAGE_PREFERENCES = ["en", "en-US", "en-GB"];
const MAX_TRANSCRIPT_CHARS = 16000;

const parseSrtTimestamp = (value) => {
	const match = value?.trim().match(/(?:(\d{1,2}):)?(\d{2}):(\d{2}),(\d{3})/);
	if (!match) return null;

	const [, hours = "0", minutes, seconds, millis] = match;
	const totalSeconds =
		Number(hours) * 3600 +
		Number(minutes) * 60 +
		Number(seconds) +
		Number(millis) / 1000;

	return Number.isFinite(totalSeconds) ? totalSeconds : null;
};

const parseSrt = (srtText) => {
	if (!srtText || typeof srtText !== "string") return [];

	const normalized = srtText.replace(/\r\n/g, "\n").trim();
	if (!normalized) return [];

	const entries = [];
	const blocks = normalized.split(/\n{2,}/);

	for (const block of blocks) {
		const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
		if (lines.length < 2) continue;

		const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
		if (timeLineIndex === -1) continue;

		const timeLine = lines[timeLineIndex];
		const [rawStart, rawEnd] = timeLine.split("-->").map((part) => part.trim());
		const startTime = parseSrtTimestamp(rawStart);
		const endTime = parseSrtTimestamp(rawEnd);

		if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
			continue;
		}

		const textLines = lines.slice(timeLineIndex + 1);
		if (textLines.length === 0) continue;

		entries.push({
			startTime,
			duration: endTime - startTime,
			text: textLines.join(" ").replace(/\s+/g, " ").trim(),
		});
	}

	return entries.sort((a, b) => a.startTime - b.startTime);
};

const selectCaptionTrack = (tracks, preferredLanguages = DEFAULT_LANGUAGE_PREFERENCES) => {
	if (!Array.isArray(tracks) || tracks.length === 0) {
		return null;
	}

	const preferred = preferredLanguages.map((lang) => lang.toLowerCase());

	for (const lang of preferred) {
		const match = tracks.find(
			(track) => track?.snippet?.language?.toLowerCase?.() === lang
		);
		if (match) return match;
	}

	const manualCaptions = tracks.filter(
		(track) => (track?.snippet?.trackKind ?? "").toLowerCase() !== "asr"
	);
	if (manualCaptions.length > 0) {
		return manualCaptions[0];
	}

	return tracks[0];
};

const formatSecondsForPrompt = (seconds) => {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return "0:00";
	}

	const totalSeconds = Math.floor(seconds);
	const hrs = Math.floor(totalSeconds / 3600);
	const mins = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;

	if (hrs > 0) {
		return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}

	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatTranscriptForPrompt = (transcript, maxChars = MAX_TRANSCRIPT_CHARS) => {
	if (!Array.isArray(transcript) || transcript.length === 0) return "";

	let buffer = "";
	for (const entry of transcript) {
		const line = `[${formatSecondsForPrompt(entry.startTime)}] ${entry.text}\n`;
		if (buffer.length + line.length > maxChars) {
			break;
		}
		buffer += line;
	}

	return buffer.trim();
};

const determineDesiredShortCount = (videoDurationSeconds) => {
	if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0) {
		return MIN_LONG_VIDEO_IDEAS;
	}

	const estimated = Math.max(1, Math.round(videoDurationSeconds / 45));
	let desired = Math.min(estimated, MAX_IDEAS);

	if (videoDurationSeconds >= LONG_VIDEO_THRESHOLD_SECONDS) {
		desired = Math.max(desired, MIN_LONG_VIDEO_IDEAS);
	}

	return Math.min(desired, MAX_IDEAS);
};

const normalizeIdea = (idea, videoDurationSeconds) => {
	if (!idea || typeof idea !== "object") return null;

	const startTime = Number(idea.startTime);
	const endTime = Number(idea.endTime);
	const title = typeof idea.title === "string" ? idea.title.trim() : "";
	const reason = typeof idea.reason === "string" ? idea.reason.trim() : "";
	const hook = typeof idea.hook === "string" ? idea.hook.trim() : "";

	if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
		return null;
	}

	const boundedStart = Math.max(0, startTime);
	const boundedEnd = Math.min(videoDurationSeconds, Math.max(endTime, boundedStart + MIN_SHORT_DURATION));
	const duration = boundedEnd - boundedStart;

	if (duration < MIN_SHORT_DURATION) {
		return null;
	}

	const cappedEnd =
		duration > MAX_SHORT_DURATION
			? Math.min(videoDurationSeconds, boundedStart + MAX_SHORT_DURATION)
			: boundedEnd;

	return {
		startTime: Number(boundedStart.toFixed(2)),
		endTime: Number(cappedEnd.toFixed(2)),
		title,
		reason,
		hook,
	};
};

const summarizeIdeas = (ideas, videoDurationSeconds, desiredCount) => {
	if (!Array.isArray(ideas)) return [];

	const normalized = ideas
		.map((idea) => normalizeIdea(idea, videoDurationSeconds))
		.filter((idea) => idea && idea.title && idea.reason && idea.hook);

	const uniqueByStart = new Map();
	for (const idea of normalized) {
		const key = idea.startTime.toFixed(2);
		if (!uniqueByStart.has(key)) {
			uniqueByStart.set(key, idea);
		}
	}

	const deduped = Array.from(uniqueByStart.values()).sort((a, b) => a.startTime - b.startTime);
	return deduped.slice(0, desiredCount);
};

let openAIClientInstance = null;

const getOpenAIClient = () => {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY environment variable not set.");
	}
	if (!openAIClientInstance) {
		openAIClientInstance = new OpenAI({ apiKey });
	}
	return openAIClientInstance;
};

/**
 * Retrieves the transcript for a YouTube video using the official YouTube Data API.
 */
async function getVideoTranscript(videoId, tokens, { preferredLanguages = DEFAULT_LANGUAGE_PREFERENCES } = {}) {
	if (!videoId) {
		throw new Error("videoId is required.");
	}

	if (Transcript) {
		const cachedTranscript = await Transcript.findOne({ videoId }).lean();
		if (cachedTranscript?.transcript?.length > 0) {
			const cachedDuration =
				typeof cachedTranscript.videoDurationSeconds === "number"
					? cachedTranscript.videoDurationSeconds
					: (() => {
							const lastEntry = cachedTranscript.transcript[cachedTranscript.transcript.length - 1];
							return lastEntry?.startTime && lastEntry?.duration
								? lastEntry.startTime + lastEntry.duration
								: 0;
					  })();

			return {
				transcript: cachedTranscript.transcript,
				videoDurationSeconds: cachedDuration,
				updatedTokens: null,
			};
		}
	}

	const oauth2Client = buildOAuthClient(tokens);
	const youtube = google.youtube({ version: "v3", auth: oauth2Client });

	try {
		const { data } = await youtube.captions.list({
			part: ["snippet"],
			videoId,
			maxResults: 50,
		});

		const tracks = data?.items ?? [];
		if (tracks.length === 0) {
			throw new Error("No captions available for this video. Please ensure captions are published or auto-generated.");
		}

		const normalizedPreferredLanguages = Array.isArray(preferredLanguages)
			? preferredLanguages.map((lang) => lang.toLowerCase())
			: [];

		const selectedTrack = selectCaptionTrack(
			tracks,
			normalizedPreferredLanguages.length > 0 ? normalizedPreferredLanguages : preferredLanguages
		);
		if (!selectedTrack?.id) {
			throw new Error("Failed to select a caption track for this video.");
		}

		const accessTokenResponse = await oauth2Client.getAccessToken();
		const accessToken =
			accessTokenResponse?.token ??
			oauth2Client.credentials?.access_token ??
			tokens?.accessToken ??
			tokens?.access_token;

		if (!accessToken) {
			throw new Error("Unable to obtain access token to download captions.");
		}

		const captionUrl = `https://www.googleapis.com/youtube/v3/captions/${selectedTrack.id}`;
		const { data: captionData } = await axios.get(captionUrl, {
			params: {
				alt: "media",
				tfmt: "srt",
			},
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			responseType: "text",
		});

		const transcriptEntries = parseSrt(typeof captionData === "string" ? captionData : "");
		const videoDurationSeconds =
			transcriptEntries.length > 0
				? transcriptEntries[transcriptEntries.length - 1].startTime +
				  transcriptEntries[transcriptEntries.length - 1].duration
				: 0;

		if (Transcript) {
			await Transcript.findOneAndUpdate(
				{ videoId },
				{
					videoId,
					transcript: transcriptEntries,
					videoDurationSeconds,
					language: selectedTrack?.snippet?.language ?? null,
					captionTrackId: selectedTrack?.id ?? null,
					lastFetchedAt: new Date(),
				},
				{
					upsert: true,
					new: true,
					setDefaultsOnInsert: true,
				}
			);
		}

		const credentials = oauth2Client.credentials ?? {};
		const updatedTokens = {
			accessToken: credentials.access_token ?? tokens?.accessToken ?? null,
			refreshToken: credentials.refresh_token ?? tokens?.refreshToken ?? null,
			scope: credentials.scope ?? tokens?.scope ?? null,
			tokenType: credentials.token_type ?? tokens?.tokenType ?? null,
			expiryDate: credentials.expiry_date ?? tokens?.expiryDate ?? null,
		};

		return {
			transcript: transcriptEntries,
			videoDurationSeconds,
			updatedTokens,
		};
	} catch (error) {
		const message = error?.response?.data || error?.message || error;
		console.error("Error fetching transcript:", message);
		if (message?.error?.errors?.[0]?.reason === "insufficientPermissions") {
			throw new Error("Insufficient permissions to access captions for this video.");
		}
		throw new Error("Unable to retrieve captions for this video.");
	}
}

/**
 * Analyzes a video transcript with OpenAI to find engaging clips.
 */
async function analyzeTranscriptForShorts({ transcript, videoTitle, videoDurationSeconds, desiredCount }) {
	const openai = getOpenAIClient();
	const formattedTranscript = formatTranscriptForPrompt(transcript);

	const responseSchema = {
		type: "object",
		additionalProperties: false,
		properties: {
			ideas: {
				type: "array",
				minItems: Math.max(1, Math.min(desiredCount, MAX_IDEAS)),
				maxItems: MAX_IDEAS,
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						startTime: {
							type: "number",
							description: "Start of the clip in seconds.",
							minimum: 0,
						},
						endTime: {
							type: "number",
							description: "End of the clip in seconds.",
							minimum: 0,
						},
						title: {
							type: "string",
							description: "Catchy short-form title.",
							minLength: 3,
						},
						reason: {
							type: "string",
							description: "Why the clip will perform well.",
							minLength: 10,
						},
						hook: {
							type: "string",
							description: "Hook or on-screen text for the first 3 seconds.",
							minLength: 3,
						},
					},
					required: ["startTime", "endTime", "title", "reason", "hook"],
				},
			},
		},
		required: ["ideas"],
	};

	const prompt = [
		"You are a YouTube Shorts strategist.",
		"Analyze the transcript and suggest high-impact clips for 30-55 second shorts.",
		`Video title: ${videoTitle || "Untitled video"}`,
		`Video duration: ${Math.round(videoDurationSeconds || 0)} seconds`,
		`Aim for ${Math.min(desiredCount, MAX_IDEAS)} shorts (provide fewer only if the content cannot support that many).`,
		"Ensure each suggestion:",
		"- Has a duration between 30 and 55 seconds (adjust end times if necessary).",
		"- Is compelling, with a clear hook and explanation of its appeal.",
		"- Uses timestamps available in the transcript. Do not invent timestamps outside of the video.",
		`Respond with a JSON object shaped as {"ideas": [...]}.`,
		"",
		"Transcript:",
		formattedTranscript || "[Transcript unavailable]",
	].join("\n");

	try {
		const response = await openai.responses.create({
			model: "gpt-4.1-nano",
			input: prompt,
			temperature: 0.3,
			max_output_tokens: 2000,
			text: {
				format: {
					type: "json_schema",
					name: "shortIdeas",
					schema: responseSchema,
					strict: true,
				},
			},
		});

		const jsonText =
			response?.output?.[0]?.content?.[0]?.text ??
			response?.output_text ??
			"";

		const trimmed = typeof jsonText === "string" ? jsonText.trim() : "";
		if (!trimmed) {
			throw new Error("OpenAI returned an empty response.");
		}

		const parsed = JSON.parse(trimmed);
		if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.ideas)) {
			throw new Error("OpenAI response did not include an 'ideas' array.");
		}

		return parsed.ideas;
	} catch (error) {
		console.error("Error analyzing video with OpenAI:", error);
		throw new Error("Failed to analyze video transcript with AI.");
	}
}

/**
 * Main function that ties everything together.
 */
export async function generateShortsIdeas(videoId, videoTitle, tokens) {
	const { transcript, videoDurationSeconds, updatedTokens } = await getVideoTranscript(videoId, tokens);

	if (!transcript || transcript.length === 0) {
		return {
			ideas: [],
			updatedTokens,
		};
	}

	const desiredCount = determineDesiredShortCount(videoDurationSeconds);
	const ideas = await analyzeTranscriptForShorts({
		transcript,
		videoTitle,
		videoDurationSeconds,
		desiredCount,
	});

	return {
		ideas: summarizeIdeas(ideas, videoDurationSeconds, desiredCount),
		updatedTokens,
	};
}
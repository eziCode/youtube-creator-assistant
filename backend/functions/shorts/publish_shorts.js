import crypto from "crypto";
import { google } from "googleapis";
import { buildOAuthClient } from "../../utils/googleOAuthClient.js";

const SHORT_MIN_DURATION_SECONDS = 30;
const SHORT_MAX_DURATION_SECONDS = 60;

const coerceNumber = (value) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
};

const sanitizeTitle = (value) => {
	if (typeof value !== "string") {
		return "";
	}
	const trimmed = value.trim();
	return trimmed.slice(0, 95);
};

const sanitizeHook = (value) => {
	if (typeof value !== "string") {
		return "";
	}
	const trimmed = value.trim();
	return trimmed.slice(0, 140);
};

const validateClipWindow = (startTime, endTime) => {
	if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
		return false;
	}
	if (startTime < 0 || endTime <= startTime) {
		return false;
	}
	const duration = endTime - startTime;
	return duration >= SHORT_MIN_DURATION_SECONDS && duration <= SHORT_MAX_DURATION_SECONDS + 10;
};

const buildShareUrl = (videoId, startTime) => {
	const timestamp = Math.max(0, Math.floor(startTime));
	return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${timestamp}s`;
};

/**
 * Attempts to publish a short derived from a parent long-form video.
 * NOTE: This implementation currently schedules the clip creation job and returns a preview link.
 * Integrating an FFmpeg clipping pipeline and invoking `youtube.videos.insert` should be done in a follow-up iteration.
 */
export async function publishShortClip({ videoId, clip, tokens, videoTitle }) {
	if (!videoId || typeof videoId !== "string") {
		throw new Error("videoId is required to publish a short.");
	}

	console.info("[publishShortClip] starting publish flow", {
		videoId,
		videoTitle,
		clipStart: clip?.startTime,
		clipEnd: clip?.endTime,
	});

	if (!clip || typeof clip !== "object") {
		throw new Error("clip payload is required.");
	}

	const startTime = coerceNumber(clip.startTime);
	const endTime = coerceNumber(clip.endTime);
	const derivedTitle = sanitizeTitle(clip.title ?? videoTitle ?? "Untitled Short");
	const hook = sanitizeHook(clip.hook);
	const reason = typeof clip.reason === "string" ? clip.reason.trim() : "";

	if (!validateClipWindow(startTime, endTime)) {
		throw new Error("Clip timestamps must define a 30-60 second window within the source video.");
	}

	const oauth2Client = buildOAuthClient(tokens);
	const youtube = google.youtube({ version: "v3", auth: oauth2Client });

	try {
		console.info("[publishShortClip] verifying source video via YouTube API");
		await youtube.videos.list({
			part: ["id"],
			id: [videoId],
			maxResults: 1,
		});
		console.info("[publishShortClip] source video verified");
	} catch (error) {
		const message = error?.response?.data || error?.message || error;
		console.error("[publishShortClip] Failed to verify source video:", message);
		throw new Error("Unable to verify the source video for publishing.");
	}

	const jobId = crypto.randomUUID();
	const shareUrl = buildShareUrl(videoId, startTime);
	const estimatedProcessingSeconds = Math.max(60, Math.round((endTime - startTime) * 2));

	console.info("[publishShortClip] queuing clip export job", {
		jobId,
		videoId,
		startTime,
		endTime,
		duration: endTime - startTime,
		title: derivedTitle,
	});

	return {
		jobId,
		status: "queued",
		shareUrl,
		estimatedProcessingSeconds,
		metadata: {
			videoId,
			startTime,
			endTime,
			title: derivedTitle,
			hook,
			reason,
		},
	};
}
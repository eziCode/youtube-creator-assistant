import { API_BASE_URL } from "../constants";
import { ShortClip, ShortPublicationResult } from "../types";

const normalizeShortIdea = (idea: any): ShortClip | null => {
	if (!idea || typeof idea !== "object") {
		return null;
	}

	const startTime = Number(idea.startTime);
	const endTime = Number(idea.endTime);
	const title = typeof idea.title === "string" ? idea.title.trim() : "";
	const reason = typeof idea.reason === "string" ? idea.reason.trim() : "";
	const hook = typeof idea.hook === "string" ? idea.hook.trim() : "";

	if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
		return null;
	}

	if (endTime <= startTime) {
		return null;
	}

	if (!title || !reason || !hook) {
		return null;
	}

	return {
		startTime,
		endTime,
		title,
		reason,
		hook,
	};
};

export const fetchShortIdeas = async (videoId: string, videoTitle?: string): Promise<ShortClip[]> => {
	const baseUrl = API_BASE_URL.replace(/\/$/, "");

	const response = await fetch(`${baseUrl}/shorts/ideas`, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			videoId,
			videoTitle,
		}),
	});

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			(payload &&
				typeof payload === "object" &&
				"error" in payload &&
				typeof payload.error === "string"
				? payload.error
				: `Failed to generate shorts ideas (status ${response.status})`);
		throw new Error(message);
	}

	const ideas = Array.isArray(payload?.ideas) ? payload.ideas : [];
	const normalized = ideas
		.map((idea) => normalizeShortIdea(idea))
		.filter((idea): idea is ShortClip => Boolean(idea));

	return normalized;
};

export const publishShortClip = async (
	videoId: string,
	clip: ShortClip,
	videoTitle?: string
): Promise<ShortPublicationResult> => {
	const baseUrl = API_BASE_URL.replace(/\/$/, "");

	const response = await fetch(`${baseUrl}/shorts/publish`, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			videoId,
			videoTitle,
			clip,
		}),
	});

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			(payload &&
				typeof payload === "object" &&
				"error" in payload &&
				typeof payload.error === "string"
				? payload.error
				: `Failed to publish short (status ${response.status})`);
		throw new Error(message);
	}

	const publication = payload?.publication;

	if (!publication || typeof publication !== "object" || typeof publication.jobId !== "string") {
		throw new Error("Unexpected response while publishing the short.");
	}

	return publication as ShortPublicationResult;
};


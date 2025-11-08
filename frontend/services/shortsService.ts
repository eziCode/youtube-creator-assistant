import { API_BASE_URL } from "../constants";
import {
	ShortClip,
	ShortPublicationResult,
	ShortDownload,
	ShortDownloadStatus,
} from "../types";

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

const parseDownload = (data: any): ShortDownload => {
	if (!data || typeof data !== "object") {
		throw new Error("Invalid download payload");
	}
	return {
		id: String(data.id),
		videoId: String(data.videoId ?? ""),
		status: (data.status ?? "pending") as ShortDownloadStatus,
		filePath: typeof data.filePath === "string" ? data.filePath : null,
		startedAt: typeof data.startedAt === "string" ? data.startedAt : null,
		completedAt: typeof data.completedAt === "string" ? data.completedAt : null,
	};
};

export const initiateShortDownload = async (videoId: string): Promise<ShortDownload> => {
	const baseUrl = API_BASE_URL.replace(/\/$/, "");

	const response = await fetch(`${baseUrl}/shorts/download`, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			videoId,
		}),
	});

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			payload && typeof payload === "object" && typeof payload.error === "string"
				? payload.error
				: `Failed to start download (status ${response.status})`;
		throw new Error(message);
	}

	return parseDownload(payload?.download);
};

export const cancelShortDownload = async (downloadId: string, purge = false): Promise<void> => {
	const baseUrl = API_BASE_URL.replace(/\/$/, "");

	const response = await fetch(
		`${baseUrl}/shorts/download/${encodeURIComponent(downloadId)}?purge=${purge ? "true" : "false"}`,
		{
			method: "DELETE",
			credentials: "include",
		}
	);

	if (!response.ok) {
		const payload = await response.json().catch(() => null);
		const message =
			payload && typeof payload === "object" && typeof payload.error === "string"
				? payload.error
				: `Failed to cancel download (status ${response.status})`;
		throw new Error(message);
	}
};

export const fetchDownloadStatus = async (downloadId: string): Promise<ShortDownload> => {
	const baseUrl = API_BASE_URL.replace(/\/$/, "");

	const response = await fetch(`${baseUrl}/shorts/download/${encodeURIComponent(downloadId)}`, {
		method: "GET",
		credentials: "include",
	});

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			payload && typeof payload === "object" && typeof payload.error === "string"
				? payload.error
				: `Failed to fetch download status (status ${response.status})`;
		throw new Error(message);
	}

	return parseDownload(payload?.download);
};

interface PublishShortClipParams {
	videoId: string;
	clip: ShortClip;
	videoTitle?: string;
	downloadId: string;
}

export const publishShortClip = async ({
	videoId,
	clip,
	videoTitle,
	downloadId,
}: PublishShortClipParams): Promise<ShortPublicationResult> => {
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
			downloadId,
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

export const fetchShortPublicationStatus = async (
	jobId: string
): Promise<ShortPublicationResult> => {
	const baseUrl = API_BASE_URL.replace(/\/$/, "");

	const response = await fetch(`${baseUrl}/shorts/publish/${encodeURIComponent(jobId)}`, {
		method: "GET",
		credentials: "include",
	});

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			(payload &&
				typeof payload === "object" &&
				"error" in payload &&
				typeof payload.error === "string"
				? payload.error
				: `Failed to fetch job status (status ${response.status})`);
		throw new Error(message);
	}

	const publication = payload?.publication;
	if (!publication || typeof publication !== "object" || typeof publication.jobId !== "string") {
		throw new Error("Unexpected response while fetching the job status.");
	}

	return publication as ShortPublicationResult;
};


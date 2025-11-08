import fs from "fs";
import path from "path";
import { stat } from "fs/promises";
import { google } from "googleapis";
import { buildOAuthClient } from "../../utils/googleOAuthClient.js";

const SUPPORTED_MIME_TYPES = {
	mp4: "video/mp4",
	mov: "video/quicktime",
	m4v: "video/x-m4v",
	webm: "video/webm",
	mpeg: "video/mpeg",
	mpg: "video/mpeg",
	ogg: "video/ogg",
	ogv: "video/ogg",
};

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS = 30;
const MAX_TAG_LENGTH = 100;
const DEFAULT_CATEGORY_ID = "22";
const ALLOWED_PRIVACY_STATUSES = new Set(["private", "unlisted", "public"]);

const sanitizeTitle = (value) => {
	if (typeof value !== "string") {
		return "Untitled Short";
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return "Untitled Short";
	}
	return trimmed.slice(0, MAX_TITLE_LENGTH);
};

const sanitizeDescription = (value) => {
	if (typeof value !== "string") {
		return "";
	}
	return value.trim().slice(0, MAX_DESCRIPTION_LENGTH);
};

const sanitizeTags = (value) => {
	if (!Array.isArray(value)) {
		return [];
	}
	const normalized = [];
	for (const tag of value) {
		if (typeof tag !== "string") continue;
		const trimmed = tag.trim();
		if (!trimmed) continue;
		normalized.push(trimmed.slice(0, MAX_TAG_LENGTH));
		if (normalized.length >= MAX_TAGS) break;
	}
	return normalized;
};

const resolveMimeType = (filePath) => {
	const ext = path.extname(filePath).slice(1).toLowerCase();
	if (SUPPORTED_MIME_TYPES[ext]) {
		return SUPPORTED_MIME_TYPES[ext];
	}
	return "video/*";
};

export async function uploadShortVideo({
	filePath,
	title,
	description = "",
	tags = [],
	privacyStatus = "private",
	madeForKids = false,
	defaultLanguage,
	categoryId = DEFAULT_CATEGORY_ID,
	notifySubscribers = false,
	tokens,
}) {
	if (!filePath || typeof filePath !== "string") {
		throw new Error("filePath is required to upload a video.");
	}

	const resolvedPath = path.resolve(filePath);

	let fileStats;
	try {
		fileStats = await stat(resolvedPath);
	} catch (error) {
		throw new Error(`Video file not found at path: ${filePath}`);
	}

	if (!fileStats.isFile()) {
		throw new Error("The provided filePath does not point to a file.");
	}

	const sanitizedTitle = sanitizeTitle(title);
	const sanitizedDescription = sanitizeDescription(description);
	const sanitizedTags = sanitizeTags(tags);
	const normalizedPrivacy = ALLOWED_PRIVACY_STATUSES.has(privacyStatus) ? privacyStatus : "private";
	const normalizedCategoryId =
		typeof categoryId === "string" && categoryId.trim() ? categoryId.trim() : DEFAULT_CATEGORY_ID;

	const oauth2Client = buildOAuthClient(tokens);
	const youtube = google.youtube({ version: "v3", auth: oauth2Client });

	const mimeType = resolveMimeType(resolvedPath);

	console.info("[uploadShortVideo] uploading file", {
		filePath: resolvedPath,
		fileSizeBytes: fileStats.size,
		title: sanitizedTitle,
		privacyStatus: normalizedPrivacy,
		categoryId: normalizedCategoryId,
		madeForKids: Boolean(madeForKids),
		notifySubscribers: Boolean(notifySubscribers),
	});

	const requestBody = {
		snippet: {
			title: sanitizedTitle,
			description: sanitizedDescription,
			categoryId: normalizedCategoryId,
		},
		status: {
			privacyStatus: normalizedPrivacy,
			selfDeclaredMadeForKids: Boolean(madeForKids),
		},
	};

	if (sanitizedTags.length > 0) {
		requestBody.snippet.tags = sanitizedTags;
	}
	if (typeof defaultLanguage === "string" && defaultLanguage.trim()) {
		requestBody.snippet.defaultLanguage = defaultLanguage.trim();
	}

	try {
		const response = await youtube.videos.insert({
			part: ["snippet", "status"],
			notifySubscribers: Boolean(notifySubscribers),
			requestBody,
			media: {
				body: fs.createReadStream(resolvedPath),
				mimeType,
			},
		});

		const videoId = response?.data?.id;
		if (!videoId) {
			throw new Error("YouTube API did not return a video ID after upload.");
		}

		const credentials = oauth2Client.credentials ?? {};
		const updatedTokens = {
			accessToken: credentials.access_token ?? tokens?.accessToken ?? null,
			refreshToken: credentials.refresh_token ?? tokens?.refreshToken ?? null,
			scope: credentials.scope ?? tokens?.scope ?? null,
			tokenType: credentials.token_type ?? tokens?.tokenType ?? null,
			expiryDate: credentials.expiry_date ?? tokens?.expiryDate ?? null,
			idToken: credentials.id_token ?? tokens?.idToken ?? null,
		};

		console.info("[uploadShortVideo] upload complete", {
			videoId,
			privacyStatus: normalizedPrivacy,
			responseStatus: response.status,
		});

		return {
			videoId,
			response: response.data,
			updatedTokens,
		};
	} catch (error) {
		const message = error?.response?.data || error?.message || error;
		console.error("[uploadShortVideo] failed to upload video", message);
		throw new Error("Failed to upload video to YouTube.");
	}
}

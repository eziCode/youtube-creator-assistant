import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "path";
import generateRouter from "./routes/generate.js";

import { retrieveComments } from "../functions/comments/retrieve_comments.js";
import { getVideos } from "../functions/dashboard/get_videos.js";
import {
	getChannelAnalyticsOverview,
	getVideoAnalyticsOverview,
} from "../functions/dashboard/get_channel_analytics.js";
import { createCommentResponses } from "../functions/comments/create_comment_responses.js";
import { respondToComments } from "../functions/comments/respond_to_comments.js";
import { generateShortsIdeas } from "../functions/shorts/create_shorts.js";
import {
	startDownload as startShortDownload,
	cancelDownload as cancelShortDownload,
	getDownload as getShortDownload,
} from "../functions/shorts/download_manager.js";
import {
	createShortJob,
	getJob as getShortJob,
} from "../functions/shorts/shorts_job_manager.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (date) => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		return null;
	}
	return date.toISOString().slice(0, 10);
};

const buildCustomDateRange = (startIso, endIso) => {
	if (typeof startIso !== "string" || typeof endIso !== "string") {
		return null;
	}

	const start = new Date(`${startIso}T00:00:00Z`);
	const end = new Date(`${endIso}T23:59:59Z`);

	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		return null;
	}

	if (start > end) {
		return null;
	}

	const normalizedStart = new Date(startIso);
	const normalizedEnd = new Date(endIso);
	normalizedStart.setUTCHours(0, 0, 0, 0);
	normalizedEnd.setUTCHours(0, 0, 0, 0);

	const diffDays = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_MS) + 1;

	if (!Number.isFinite(diffDays) || diffDays <= 0) {
		return null;
	}

	const previousEnd = new Date(normalizedStart.getTime() - DAY_MS);
	const previousStart = new Date(previousEnd.getTime() - (diffDays - 1) * DAY_MS);

	const formattedCurrentStart = formatDate(normalizedStart);
	const formattedCurrentEnd = formatDate(normalizedEnd);
	const formattedPreviousStart = formatDate(previousStart);
	const formattedPreviousEnd = formatDate(previousEnd);

	if (!formattedCurrentStart || !formattedCurrentEnd || !formattedPreviousStart || !formattedPreviousEnd) {
		return null;
	}

	return {
		current: {
			startDate: formattedCurrentStart,
			endDate: formattedCurrentEnd,
		},
		previous: {
			startDate: formattedPreviousStart,
			endDate: formattedPreviousEnd,
		},
	};
};

const FRONTEND_ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "yca.sid";
const SESSION_COLLECTION_NAME = process.env.SESSION_COLLECTION_NAME || "sessions";
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS) || 60 * 60 * 24 * 14;
const isProduction = process.env.NODE_ENV === "production";
const sameSite = isProduction ? "none" : "lax";

if (!MONGODB_URI) {
	console.error("[app] Missing MONGODB_URI environment variable.");
}

if (!SESSION_SECRET) {
	console.error("[app] Missing SESSION_SECRET environment variable.");
}

app.set("trust proxy", 1);

app.use(express.json());
app.use(
	cors({
		origin: FRONTEND_ORIGIN,
		credentials: true,
	})
);

const registerRoutes = () => {
	app.use("/auth", authRouter);
	app.use("/generate", generateRouter);

	app.post("/shorts/download", async (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const { videoId } = req.body ?? {};

		if (!videoId || typeof videoId !== "string") {
			return res.status(400).json({ error: "videoId is required" });
		}

		try {
			const previousDownloadId = req.session?.activeShortDownloadId;
			if (previousDownloadId) {
				await cancelShortDownload(previousDownloadId, { deleteFile: true });
			}

			const download = await startShortDownload({
				videoId,
				sessionId: req.sessionID,
				outputDir: path.resolve(process.cwd(), "downloads"),
			});

			req.session.activeShortDownloadId = download.id;
			req.session.activeShortVideoId = videoId;

			await new Promise((resolve, reject) => {
				req.session.save((err) => {
					if (err) reject(err);
					else resolve();
				});
			});

			return res.json({ download });
		} catch (err) {
			console.error("[routes:/shorts/download] failed to start download", err);
			return res.status(500).json({ error: err.message || "failed to start download" });
		}
	});

	app.delete("/shorts/download/:downloadId", async (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const { downloadId } = req.params;
		const purge = req.query?.purge === "true" || req.query?.purge === "1";

		if (!downloadId) {
			return res.status(400).json({ error: "downloadId is required" });
		}

		const download = getShortDownload(downloadId);
		if (!download) {
			return res.status(404).json({ error: "download not found" });
		}

		if (download.sessionId !== req.sessionID) {
			return res.status(403).json({ error: "not authorized to modify this download" });
		}

		try {
			await cancelShortDownload(downloadId, { deleteFile: purge });

			if (req.session.activeShortDownloadId === downloadId) {
				delete req.session.activeShortDownloadId;
				delete req.session.activeShortVideoId;

				await new Promise((resolve, reject) => {
					req.session.save((err) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}

			return res.json({ success: true });
		} catch (err) {
			console.error("[routes:/shorts/download] failed to cancel download", err);
			return res.status(500).json({ error: err.message || "failed to cancel download" });
		}
	});

	app.get("/shorts/download/:downloadId", (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const { downloadId } = req.params;
		if (!downloadId) {
			return res.status(400).json({ error: "downloadId is required" });
		}

		const download = getShortDownload(downloadId);
		if (!download || download.sessionId !== req.sessionID) {
			return res.status(404).json({ error: "download not found" });
		}

		return res.json({ download });
	});

	app.get("/retrieve-comments", async (req, res) => {
		const videoId = req.query.videoId;
		if (!videoId) return res.status(400).json({ error: "videoId query param required" });

		try {
			const comments = await retrieveComments(videoId);
			return res.json({ comments });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to retrieve comments" });
		}
	});

	app.post("/comments/respond", async (req, res) => {
		const { responses: providedResponses, comments: providedComments, videoId, maxResponses } = req.body ?? {};

		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		let responseMap = null;

		try {
			if (providedResponses && typeof providedResponses === "object" && !Array.isArray(providedResponses)) {
				responseMap = providedResponses;
			} else {
				let sourceComments = Array.isArray(providedComments) ? providedComments : null;

				if (!sourceComments) {
					if (!videoId || typeof videoId !== "string") {
						return res.status(400).json({
							error:
								"Provide either a responses map, an array of comments, or a videoId to auto-generate responses.",
						});
					}

					sourceComments = await retrieveComments(videoId);
				}

				responseMap = await createCommentResponses(sourceComments, { maxResponses });
			}

			if (!responseMap || typeof responseMap !== "object" || Array.isArray(responseMap) || Object.keys(responseMap).length === 0) {
				return res.status(400).json({ error: "No responses available to post" });
			}

			const result = await respondToComments(responseMap, req.session.tokens);

			if (req.session && result.updatedTokens) {
				req.session.tokens = {
					...req.session.tokens,
					...result.updatedTokens,
				};

				await new Promise((resolve, reject) => {
					req.session.save((err) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}

			return res.json({
				successes: result.successes,
				failures: result.failures,
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to respond to comments" });
		}
	});

	app.get("/dashboard/videos", async (req, res) => {
		const { channelId, maxResults } = req.query;
		if (!channelId) {
			return res.status(400).json({ error: "channelId query param required" });
		}

		try {
			const videos = await getVideos(channelId, { maxResults });
			return res.json({ videos });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to retrieve videos" });
		}
	});

	app.get("/dashboard/analytics/overview", async (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const channelId = req.session?.user?.channelId;
		const rangeDaysRaw = req.query?.rangeDays;
		const startDateRaw = req.query?.startDate;
		const endDateRaw = req.query?.endDate;
		const hasCustomRange = typeof startDateRaw === "string" && typeof endDateRaw === "string";
		const dateRange = hasCustomRange ? buildCustomDateRange(startDateRaw, endDateRaw) : undefined;

		if (hasCustomRange && !dateRange) {
			return res.status(400).json({ error: "Invalid custom date range" });
		}

		const rangeDays =
			!hasCustomRange && rangeDaysRaw && Number.isFinite(Number(rangeDaysRaw))
				? Number(rangeDaysRaw)
				: undefined;

		if (!channelId) {
			return res.status(400).json({ error: "channelId unavailable for this user" });
		}

		try {
			const result = await getChannelAnalyticsOverview({
				channelId,
				tokens: req.session.tokens,
				rangeDays,
				dateRange,
			});

			if (req.session && result.updatedTokens) {
				req.session.tokens = {
					...req.session.tokens,
					...result.updatedTokens,
				};

				await new Promise((resolve, reject) => {
					req.session.save((err) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}

			return res.json({ analytics: result.analytics });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to retrieve analytics" });
		}
	});

	app.get("/dashboard/analytics/video", async (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const channelId = req.session?.user?.channelId;
		const { videoId } = req.query;
		const rangeDaysRaw = req.query?.rangeDays;
		const startDateRaw = req.query?.startDate;
		const endDateRaw = req.query?.endDate;
		const hasCustomRange = typeof startDateRaw === "string" && typeof endDateRaw === "string";
		const dateRange = hasCustomRange ? buildCustomDateRange(startDateRaw, endDateRaw) : undefined;

		if (hasCustomRange && !dateRange) {
			return res.status(400).json({ error: "Invalid custom date range" });
		}

		const rangeDays =
			!hasCustomRange && rangeDaysRaw && Number.isFinite(Number(rangeDaysRaw))
				? Number(rangeDaysRaw)
				: undefined;

		if (!channelId) {
			return res.status(400).json({ error: "channelId unavailable for this user" });
		}

		if (!videoId || typeof videoId !== "string") {
			return res.status(400).json({ error: "videoId query param required" });
		}

		try {
			const result = await getVideoAnalyticsOverview({
				channelId,
				videoId,
				tokens: req.session.tokens,
				rangeDays,
				dateRange,
			});

			if (req.session && result.updatedTokens) {
				req.session.tokens = {
					...req.session.tokens,
					...result.updatedTokens,
				};

				await new Promise((resolve, reject) => {
					req.session.save((err) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}

			return res.json({ analytics: result.analytics });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to retrieve video analytics" });
		}
	});

	app.post("/shorts/ideas", async (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const { videoId, videoTitle } = req.body ?? {};

		if (!videoId || typeof videoId !== "string") {
			return res.status(400).json({ error: "videoId is required" });
		}

		try {
			const result = await generateShortsIdeas(videoId, videoTitle ?? "", req.session.tokens);

			if (req.session && result.updatedTokens) {
				req.session.tokens = {
					...req.session.tokens,
					...result.updatedTokens,
				};

				await new Promise((resolve, reject) => {
					req.session.save((err) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}

			return res.json({ ideas: result.ideas });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to generate short ideas" });
		}
	});

	app.post("/shorts/publish", async (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const { videoId, clip, videoTitle, downloadId } = req.body ?? {};

		console.info("[routes:/shorts/publish] incoming publish request", {
			videoId,
			hasClip: Boolean(clip),
			videoTitle,
			downloadId,
			sessionUser: req.session?.user?.email ?? req.session?.user?.id ?? "unknown",
		});

		if (!videoId || typeof videoId !== "string") {
			return res.status(400).json({ error: "videoId is required" });
		}

		if (!downloadId || typeof downloadId !== "string") {
			return res.status(400).json({ error: "downloadId is required" });
		}

		const download = getShortDownload(downloadId);
		if (!download) {
			return res.status(400).json({ error: "download not found for this request" });
		}

		if (download.sessionId !== req.sessionID) {
			return res.status(403).json({ error: "not authorized to use this download" });
		}

		if (download.videoId !== videoId) {
			return res.status(400).json({ error: "download does not match requested videoId" });
		}

		try {
			const publication = createShortJob({
				downloadId,
				videoId,
				clip,
				videoTitle: typeof videoTitle === "string" ? videoTitle : "",
				tokens: req.session.tokens,
				sessionId: req.sessionID,
				sessionStore: req.sessionStore,
			});

			console.info("[routes:/shorts/publish] publish job created", {
				videoId,
				jobId: publication?.jobId,
				status: publication?.status,
				shareUrl: publication?.shareUrl,
			});

			return res.json({ publication });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ error: err.message || "failed to publish short" });
		}
	});

	app.get("/shorts/publish/:jobId", (req, res) => {
		if (!req.session?.tokens?.accessToken) {
			return res.status(401).json({ error: "authentication required" });
		}

		const { jobId } = req.params;
		if (!jobId) {
			return res.status(400).json({ error: "jobId is required" });
		}

		const publication = getShortJob(jobId, { sessionId: req.sessionID });
		if (!publication) {
			return res.status(404).json({ error: "job not found" });
		}

		return res.json({ publication });
	});
};

const startServer = async () => {
	try {
		if (!MONGODB_URI) {
			throw new Error("MONGODB_URI must be configured");
		}

		if (!SESSION_SECRET) {
			throw new Error("SESSION_SECRET must be configured");
		}

		mongoose.connection.on("error", (err) => {
			console.error("[mongo] connection error", err);
		});

		await mongoose.connect(MONGODB_URI, {
			dbName: process.env.MONGODB_DB_NAME,
		});

		const store = MongoStore.create({
			client: mongoose.connection.getClient(),
			collectionName: SESSION_COLLECTION_NAME,
			ttl: SESSION_TTL_SECONDS,
			stringify: false,
			autoRemove: "native",
		});

		const sessionMiddleware = session({
			name: SESSION_COOKIE_NAME,
			secret: SESSION_SECRET,
			resave: false,
			saveUninitialized: false,
			store,
			cookie: {
				maxAge: SESSION_TTL_SECONDS * 1000,
				httpOnly: true,
				sameSite,
				secure: isProduction,
			},
		});

		app.use(sessionMiddleware);
		app.set("sessionCookieName", SESSION_COOKIE_NAME);
		app.set("sessionCookieSameSite", sameSite);
		app.set("sessionCookieSecure", isProduction);

		registerRoutes();

		const PORT = process.env.PORT || 4000;
		app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
	} catch (err) {
		console.error("[app] Failed to start server", err);
		process.exit(1);
	}
};

startServer();
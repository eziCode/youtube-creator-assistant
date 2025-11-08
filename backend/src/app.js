import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import { retrieveComments } from "../functions/comments/retrieve_comments.js";
import { getVideos } from "../functions/dashboard/get_videos.js";
import {
	getChannelAnalyticsOverview,
	getVideoAnalyticsOverview,
} from "../functions/dashboard/get_channel_analytics.js";
import { createCommentResponses } from "../functions/comments/create_comment_responses.js";
import { respondToComments } from "../functions/comments/respond_to_comments.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();

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
		const rangeDays =
			rangeDaysRaw && Number.isFinite(Number(rangeDaysRaw))
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
		const rangeDays =
			rangeDaysRaw && Number.isFinite(Number(rangeDaysRaw))
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
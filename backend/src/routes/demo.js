import express from "express";
import {
	DEMO_CHANNEL_ID,
	fetchChannelProfile,
	searchChannelVideos,
	fetchUploadsPlaylistVideos,
	fetchVideosByIds,
} from "../../functions/demo/youtube_data.js";
import {
	generateDemoChannelAnalytics,
	generateDemoVideoAnalytics,
} from "../../functions/demo/mock_analytics.js";

const router = express.Router();

const buildDemoUser = (channelProfile) => {
	const displayName = channelProfile?.title ?? "MKBHD";
	const thumbnail =
		channelProfile?.thumbnails?.high?.url ??
		channelProfile?.thumbnails?.default?.url ??
		null;

	return {
		id: "demo-user-mkbhd",
		googleId: "demo-google-user",
		email: "demo@mkbhd.example.com",
		name: `${displayName} (Demo)`,
		channelId: channelProfile?.id ?? DEMO_CHANNEL_ID,
		channelTitle: displayName,
		picture: thumbnail,
	};
};

const ensureDemoTokensAvailable = () => {
	const accessToken = process.env.DEMO_ACCESS_TOKEN;
	const refreshToken = process.env.DEMO_REFRESH_TOKEN;

	if (!accessToken) {
		throw new Error("DEMO_ACCESS_TOKEN must be configured to use demo mode.");
	}

	return {
		accessToken,
		refreshToken: refreshToken || null,
	};
};

router.post("/start", async (req, res) => {
	try {
		const channelProfile = await fetchChannelProfile();
		const tokens = ensureDemoTokensAvailable();

		req.session.tokens = {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		};
		req.session.user = buildDemoUser(channelProfile);
		req.session.demoMode = true;

		await new Promise((resolve, reject) => {
			req.session.save((err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		return res.json({
			success: true,
			user: req.session.user,
			channel: channelProfile,
		});
	} catch (err) {
		console.error("[demo] failed to start demo session", err);
		return res.status(500).json({
			error: err instanceof Error ? err.message : "Failed to initialize demo session.",
		});
	}
});

router.get("/channel", async (_req, res) => {
	try {
		const channelProfile = await fetchChannelProfile();
		return res.json({ channel: channelProfile });
	} catch (err) {
		console.error("[demo] failed to fetch channel profile", err);
		return res.status(500).json({
			error: err instanceof Error ? err.message : "Failed to load channel profile.",
		});
	}
});

router.get("/videos", async (req, res) => {
	const { q, pageToken, pageSize, source } = req.query ?? {};
	const useUploadsPlaylist =
		Boolean(source) && String(source).toLowerCase() === "uploads";

	try {
		const result = useUploadsPlaylist
			? await fetchUploadsPlaylistVideos({
					pageToken,
					pageSize,
				})
			: await searchChannelVideos({
					query: q,
					pageToken,
					pageSize,
				});

		return res.json({
			videos: result.videos,
			nextPageToken: result.nextPageToken,
			prevPageToken: result.prevPageToken,
		});
	} catch (err) {
		console.error("[demo] failed to list videos", err);
		return res.status(500).json({
			error: err instanceof Error ? err.message : "Failed to load demo videos.",
		});
	}
});

router.get("/videos/bulk", async (req, res) => {
	const rawIds = req.query?.ids;
	const ids = Array.isArray(rawIds)
		? rawIds
		: typeof rawIds === "string"
		? rawIds.split(",")
		: [];

	if (!ids.length) {
		return res.status(400).json({ error: "ids query parameter is required." });
	}

	try {
		const videos = await fetchVideosByIds(ids);
		return res.json({ videos });
	} catch (err) {
		console.error("[demo] failed to bulk fetch videos", err);
		return res.status(500).json({
			error: err instanceof Error ? err.message : "Failed to load video details.",
		});
	}
});

router.get("/analytics/overview", async (req, res) => {
	const rangeDaysRaw = req.query?.rangeDays;
	const rangeDays =
		rangeDaysRaw && Number.isFinite(Number(rangeDaysRaw))
			? Number(rangeDaysRaw)
			: 28;

	try {
		const channelProfile = await fetchChannelProfile();

		const videosResult = await searchChannelVideos({
			pageSize: 25,
			order: "viewCount",
		});

		const analytics = generateDemoChannelAnalytics({
			channelProfile,
			videoSummaries: videosResult.videos,
			rangeDays,
		});

		return res.json({ analytics });
	} catch (err) {
		console.error("[demo] failed to build channel analytics", err);
		return res.status(500).json({
			error: err instanceof Error ? err.message : "Failed to load demo analytics.",
		});
	}
});

router.get("/analytics/video", async (req, res) => {
	const { videoId } = req.query ?? {};
	const rangeDaysRaw = req.query?.rangeDays;
	const rangeDays =
		rangeDaysRaw && Number.isFinite(Number(rangeDaysRaw))
			? Number(rangeDaysRaw)
			: 28;

	if (!videoId || typeof videoId !== "string") {
		return res.status(400).json({ error: "videoId query parameter is required." });
	}

	try {
		const [videoSummary] = await fetchVideosByIds([videoId]);
		if (!videoSummary) {
			return res.status(404).json({ error: "Video not found for demo analytics." });
		}

		const analytics = generateDemoVideoAnalytics({
			videoSummary,
			rangeDays,
		});

		return res.json({ analytics });
	} catch (err) {
		console.error("[demo] failed to build video analytics", err);
		return res.status(500).json({
			error: err instanceof Error ? err.message : "Failed to load demo video analytics.",
		});
	}
});

export default router;



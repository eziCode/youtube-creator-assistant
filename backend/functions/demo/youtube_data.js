import axios from "axios";

const OUTDOOR_BOYS_CHANNEL_ID =
	process.env.DEMO_CHANNEL_ID || "UCfpCQ89W9wjkHc8J_6eTbBg";

const MAX_RESULTS = 25;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const ensureApiKey = () => {
	const key = process.env.YOUTUBE_API_KEY;
	if (!key) {
		throw new Error("YOUTUBE_API_KEY must be configured for demo mode.");
	}
	return key;
};

const normalizeThumbnails = (thumbnails = {}) => {
	const normalized = {};
	Object.entries(thumbnails).forEach(([size, data]) => {
		if (!data) return;
		normalized[size] = {
			url: data.url,
			width: data.width,
			height: data.height,
		};
	});
	return normalized;
};

const normalizeVideo = (item) => {
	const snippet = item?.snippet ?? {};
	const statistics = item?.statistics ?? {};
	const contentDetails = item?.contentDetails ?? {};

	return {
		id: item?.id,
		title: snippet.title,
		description: snippet.description,
		channelId: snippet.channelId,
		channelTitle: snippet.channelTitle,
		publishedAt: snippet.publishedAt,
		thumbnails: normalizeThumbnails(snippet.thumbnails),
		duration: contentDetails.duration,
		viewCount: statistics.viewCount ? Number(statistics.viewCount) : null,
		likeCount: statistics.likeCount ? Number(statistics.likeCount) : null,
		commentCount: statistics.commentCount ? Number(statistics.commentCount) : null,
		favoriteCount: statistics.favoriteCount ? Number(statistics.favoriteCount) : null,
		categoryId: snippet.categoryId,
		tags: Array.isArray(snippet.tags) ? snippet.tags : [],
		liveBroadcastContent: snippet.liveBroadcastContent,
		defaultLanguage: snippet.defaultLanguage,
		defaultAudioLanguage: snippet.defaultAudioLanguage,
	};
};

const fetchChannelProfile = async (channelId = OUTDOOR_BOYS_CHANNEL_ID) => {
	const apiKey = ensureApiKey();

	const { data } = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
		params: {
			part: "snippet,statistics,brandingSettings,contentDetails",
			id: channelId,
			key: apiKey,
			maxResults: 1,
		},
	});

	const channel = data?.items?.[0];
	if (!channel) {
		throw new Error("Outdoor Boys channel not found via YouTube Data API.");
	}

	const snippet = channel.snippet ?? {};
	const statistics = channel.statistics ?? {};
	const brandingSettings = channel.brandingSettings ?? {};
	const uploadsPlaylistId =
		channel?.contentDetails?.relatedPlaylists?.uploads ?? null;

	return {
		id: channel.id,
		title: snippet.title,
		description: snippet.description,
		customUrl: snippet.customUrl,
		publishedAt: snippet.publishedAt,
		thumbnails: normalizeThumbnails(snippet.thumbnails),
		country: snippet.country ?? null,
		viewCount: statistics.viewCount ? Number(statistics.viewCount) : null,
		subscriberCount: statistics.hiddenSubscriberCount
			? null
			: statistics.subscriberCount
			? Number(statistics.subscriberCount)
			: null,
		videoCount: statistics.videoCount ? Number(statistics.videoCount) : null,
		hiddenSubscriberCount: Boolean(statistics.hiddenSubscriberCount),
		keywords: brandingSettings?.channel?.keywords ?? null,
		bannerImageUrl: brandingSettings?.image?.bannerExternalUrl ?? null,
		uploadsPlaylistId,
	};
};

const fetchVideosByIds = async (videoIds) => {
	if (!Array.isArray(videoIds) || videoIds.length === 0) {
		return [];
	}

	const apiKey = ensureApiKey();
	const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));
	if (!uniqueIds.length) {
		return [];
	}

	const chunks = [];
	for (let i = 0; i < uniqueIds.length; i += 50) {
		chunks.push(uniqueIds.slice(i, i + 50));
	}

	const videos = [];
	for (const chunk of chunks) {
		const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
			params: {
				part: "snippet,statistics,contentDetails",
				id: chunk.join(","),
				key: apiKey,
			},
		});

		const items = Array.isArray(data?.items) ? data.items : [];
		items.forEach((item) => videos.push(normalizeVideo(item)));
	}

	return videos;
};

const searchChannelVideos = async ({
	channelId = OUTDOOR_BOYS_CHANNEL_ID,
	query,
	pageToken,
	pageSize = MAX_RESULTS,
	order,
}) => {
	const apiKey = ensureApiKey();
	const clampedPageSize = Math.min(Math.max(Number(pageSize) || MAX_RESULTS, 1), 50);

	const params = {
		part: "id",
		channelId,
		type: "video",
		key: apiKey,
		maxResults: clampedPageSize,
		pageToken: pageToken || undefined,
	};

	if (query && typeof query === "string") {
		params.q = query;
		params.order = order || "relevance";
	} else if (order) {
		params.order = order;
	} else {
		params.order = "date";
	}

	const { data } = await axios.get(`${YOUTUBE_API_BASE}/search`, {
		params,
	});

	const items = Array.isArray(data?.items) ? data.items : [];
	const videoIds = items
		.map((item) => item?.id?.videoId)
		.filter((value) => typeof value === "string");

	const videos = await fetchVideosByIds(videoIds);
	const videoMap = new Map(videos.map((video) => [video.id, video]));

	const orderedVideos = videoIds
		.map((id) => videoMap.get(id))
		.filter(Boolean);

	return {
		videos: orderedVideos,
		nextPageToken: data?.nextPageToken ?? null,
		prevPageToken: data?.prevPageToken ?? null,
	};
};

const fetchUploadsPlaylistVideos = async ({
	channelId = OUTDOOR_BOYS_CHANNEL_ID,
	pageToken,
	pageSize = MAX_RESULTS,
}) => {
	const channelProfile = await fetchChannelProfile(channelId);
	const uploadsPlaylistId = channelProfile.uploadsPlaylistId;
	if (!uploadsPlaylistId) {
		return {
			videos: [],
			nextPageToken: null,
			prevPageToken: null,
		};
	}

	const apiKey = ensureApiKey();
	const clampedPageSize = Math.min(Math.max(Number(pageSize) || MAX_RESULTS, 1), 50);

	const { data } = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
		params: {
			part: "contentDetails",
			playlistId: uploadsPlaylistId,
			key: apiKey,
			maxResults: clampedPageSize,
			pageToken: pageToken || undefined,
		},
	});

	const items = Array.isArray(data?.items) ? data.items : [];
	const videoIds = items
		.map((item) => item?.contentDetails?.videoId)
		.filter((value) => typeof value === "string");

	const videos = await fetchVideosByIds(videoIds);
	const videoMap = new Map(videos.map((video) => [video.id, video]));

	const orderedVideos = videoIds
		.map((id) => videoMap.get(id))
		.filter(Boolean);

	return {
		videos: orderedVideos,
		nextPageToken: data?.nextPageToken ?? null,
		prevPageToken: data?.prevPageToken ?? null,
	};
};

export {
	OUTDOOR_BOYS_CHANNEL_ID,
	fetchChannelProfile,
	searchChannelVideos,
	fetchUploadsPlaylistVideos,
	fetchVideosByIds,
};



import axios from "axios";
import { buildVideoFromItem } from "../../models/video.js";

const getVideos = async (channelId, { maxResults = 25 } = {}) => {
	if (!channelId) throw new Error("channelId is required");

	const API_KEY = process.env.YOUTUBE_API_KEY;
	if (!API_KEY) throw new Error("YOUTUBE_API_KEY not set in environment");

	const sanitizedMaxResults = Number(maxResults);
	const desiredResults = Number.isFinite(sanitizedMaxResults) && sanitizedMaxResults > 0 ? sanitizedMaxResults : 25;
	const totalToFetch = Math.min(desiredResults, 200);

	const uploadsPlaylistId = await getUploadsPlaylistId(channelId, API_KEY);
	const videoIds = await listVideoIdsFromPlaylist(uploadsPlaylistId, API_KEY, totalToFetch);

	if (videoIds.length === 0) {
		return [];
	}

	const videos = await fetchVideosByIds(videoIds, API_KEY);
	return videos.map((video) => video.toJSON());
};

const getUploadsPlaylistId = async (channelId, apiKey) => {
	try {
		const response = await axios.get("https://www.googleapis.com/youtube/v3/channels", {
			params: {
				part: "contentDetails",
				id: channelId,
				key: apiKey,
				maxResults: 1,
			},
		});

		const uploadsPlaylistId =
			response.data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

		if (!uploadsPlaylistId) {
			throw new Error("Channel uploads playlist not found");
		}

		return uploadsPlaylistId;
	} catch (err) {
		const message = err?.response?.data || err.message || err;
		throw new Error(`Failed to retrieve uploads playlist: ${JSON.stringify(message)}`);
	}
};

const listVideoIdsFromPlaylist = async (playlistId, apiKey, limit) => {
	const playlistItemsUrl = "https://www.googleapis.com/youtube/v3/playlistItems";
	const videoIds = [];
	let nextPageToken;

	try {
		while (videoIds.length < limit) {
			const remaining = limit - videoIds.length;
			const maxResults = Math.min(remaining, 50);

			const response = await axios.get(playlistItemsUrl, {
				params: {
					part: "contentDetails",
					playlistId,
					key: apiKey,
					maxResults,
					pageToken: nextPageToken,
				},
			});

			const items = response.data?.items || [];
			items.forEach((item) => {
				const videoId = item?.contentDetails?.videoId;
				if (videoId) {
					videoIds.push(videoId);
				}
			});

			nextPageToken = response.data?.nextPageToken;
			if (!nextPageToken) break;
		}

		return videoIds;
	} catch (err) {
		const message = err?.response?.data || err.message || err;
		throw new Error(`Failed to retrieve playlist videos: ${JSON.stringify(message)}`);
	}
};

const fetchVideosByIds = async (videoIds, apiKey) => {
	const videosUrl = "https://www.googleapis.com/youtube/v3/videos";
	const videos = [];

	try {
		for (let i = 0; i < videoIds.length; i += 50) {
			const chunk = videoIds.slice(i, i + 50);
			const response = await axios.get(videosUrl, {
				params: {
					part: "snippet,contentDetails,statistics",
					id: chunk.join(","),
					key: apiKey,
				},
			});

			const items = response.data?.items || [];
			items.forEach((item) => {
				const video = buildVideoFromItem(item);
				videos.push(video);
			});
		}

		return videos;
	} catch (err) {
		const message = err?.response?.data || err.message || err;
		throw new Error(`Failed to retrieve video details: ${JSON.stringify(message)}`);
	}
};

export { getVideos };
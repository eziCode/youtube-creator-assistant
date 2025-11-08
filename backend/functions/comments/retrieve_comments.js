import axios from "axios";
import { buildCommentFromThread } from "../../models/comment.js";

const retrieveComments = async (videoId) => {
	if (!videoId) throw new Error("videoId is required");
	const API_KEY = process.env.YOUTUBE_API_KEY;
	if (!API_KEY) throw new Error("YOUTUBE_API_KEY not set in environment");

	const url = "https://www.googleapis.com/youtube/v3/commentThreads";
	const comments = [];
	const MAX_PAGES = 10;
	let pageToken;
	let pageCount = 0;

	try {
		do {
			const params = {
				part: "snippet,replies",
				videoId,
				key: API_KEY,
				maxResults: 10,
				order: "relevance",
			};
			if (pageToken) params.pageToken = pageToken;

			const res = await axios.get(url, { params });
			const items = res.data.items || [];

			items.forEach((item) => {
				const comment = buildCommentFromThread(item);
				comments.push(comment.toJSON());
			});

			pageToken = res.data.nextPageToken;
			pageCount += 1;
		} while (pageToken && pageCount < MAX_PAGES);

		return comments;
	} catch (err) {
		const message = err?.response?.data || err.message || err;
		throw new Error(`Failed to retrieve comments: ${JSON.stringify(message)}`);
	}
};

export { retrieveComments };
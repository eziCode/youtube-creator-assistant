import axios from "axios";

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

            console.log("Fetching comments with params:", params);

			const res = await axios.get(url, { params });
			const items = res.data.items || [];

			items.forEach((item) => {
				const top = item.snippet.topLevelComment.snippet;
				comments.push({
					id: item.id,
					text: top.textDisplay,
					author: top.authorDisplayName,
					likeCount: top.likeCount,
					publishedAt: top.publishedAt,
					kind: "topLevel",
				});

				if (item.replies && item.replies.comments) {
					item.replies.comments.forEach((rep) => {
						const r = rep.snippet;
						comments.push({
							id: rep.id,
							text: r.textDisplay,
							author: r.authorDisplayName,
							likeCount: r.likeCount,
							publishedAt: r.publishedAt,
							kind: "reply",
							replyTo: item.id,
						});
					});
				}
			});

			pageToken = res.data.nextPageToken;
			pageCount += 1;
		} while (pageToken && pageCount < MAX_PAGES);

		return comments;
	} catch (err) {
		// surface a helpful message but include original error
		const message = err?.response?.data || err.message || err;
		throw new Error(`Failed to retrieve comments: ${JSON.stringify(message)}`);
	}
};

export { retrieveComments };
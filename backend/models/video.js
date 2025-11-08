class Video {
	constructor({
		id,
		title,
		description,
		channelId,
		channelTitle,
		publishedAt,
		thumbnails,
		duration,
		tags,
		liveBroadcastContent,
		defaultLanguage,
		defaultAudioLanguage,
		viewCount,
		likeCount,
		commentCount,
		favoriteCount,
		categoryId,
	}) {
		this.id = id;
		this.title = title;
		this.description = description;
		this.channelId = channelId;
		this.channelTitle = channelTitle;
		this.publishedAt = publishedAt;
		this.thumbnails = thumbnails;
		this.duration = duration;
		this.tags = tags;
		this.liveBroadcastContent = liveBroadcastContent;
		this.defaultLanguage = defaultLanguage;
		this.defaultAudioLanguage = defaultAudioLanguage;
		this.viewCount = viewCount;
		this.likeCount = likeCount;
		this.commentCount = commentCount;
		this.favoriteCount = favoriteCount;
		this.categoryId = categoryId;
	}

	toJSON() {
		return {
			id: this.id,
			title: this.title,
			description: this.description,
			channelId: this.channelId,
			channelTitle: this.channelTitle,
			publishedAt: this.publishedAt,
			thumbnails: this.thumbnails,
			duration: this.duration,
			tags: this.tags,
			liveBroadcastContent: this.liveBroadcastContent,
			defaultLanguage: this.defaultLanguage,
			defaultAudioLanguage: this.defaultAudioLanguage,
			viewCount: this.viewCount,
			likeCount: this.likeCount,
			commentCount: this.commentCount,
			favoriteCount: this.favoriteCount,
			categoryId: this.categoryId,
		};
	}
}

const normalizeThumbnails = (thumbnails = {}) => {
	const normalized = {};
	Object.entries(thumbnails).forEach(([key, value]) => {
		if (!value) return;
		normalized[key] = {
			url: value.url,
			width: value.width,
			height: value.height,
		};
	});
	return normalized;
};

const buildVideoFromItem = (item) => {
	if (!item) throw new Error("Video item is required");

	const snippet = item.snippet || {};
	const statistics = item.statistics || {};
	const contentDetails = item.contentDetails || {};

	return new Video({
		id: item.id,
		title: snippet.title,
		description: snippet.description,
		channelId: snippet.channelId,
		channelTitle: snippet.channelTitle,
		publishedAt: snippet.publishedAt,
		thumbnails: normalizeThumbnails(snippet.thumbnails),
		duration: contentDetails.duration,
		tags: snippet.tags || [],
		liveBroadcastContent: snippet.liveBroadcastContent,
		defaultLanguage: snippet.defaultLanguage,
		defaultAudioLanguage: snippet.defaultAudioLanguage,
		viewCount: statistics.viewCount ? Number(statistics.viewCount) : null,
		likeCount: statistics.likeCount ? Number(statistics.likeCount) : null,
		commentCount: statistics.commentCount ? Number(statistics.commentCount) : null,
		favoriteCount: statistics.favoriteCount ? Number(statistics.favoriteCount) : null,
		categoryId: snippet.categoryId,
	});
};

export { Video, buildVideoFromItem };


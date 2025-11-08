class Comment {
	constructor({ id, threadId, text, author, likeCount, publishedAt, replies = [], replyCount = 0 }) {
		this.id = id;
		this.threadId = threadId;
		this.text = text;
		this.author = author;
		this.likeCount = likeCount;
		this.publishedAt = publishedAt;
		this.replyCount = replyCount;
		this.replies = replies;
	}

	toJSON() {
		return {
			id: this.id,
			threadId: this.threadId,
			text: this.text,
			author: this.author,
			likeCount: this.likeCount,
			publishedAt: this.publishedAt,
			replyCount: this.replyCount,
			replies: this.replies,
		};
	}
}

const buildAuthor = (snippet) => ({
	displayName: snippet.authorDisplayName,
	channelId: snippet.authorChannelId?.value || null,
	channelUrl: snippet.authorChannelUrl || null,
	profileImageUrl: snippet.authorProfileImageUrl || null,
});

const buildCommentFromThread = (thread) => {
	const topLevelComment = thread.snippet.topLevelComment;
	const topSnippet = topLevelComment.snippet;
	const replies = (thread.replies?.comments || []).map((reply) => {
		const r = reply.snippet;
		return {
			id: reply.id,
			text: r.textDisplay,
			author: buildAuthor(r),
			likeCount: r.likeCount,
			publishedAt: r.publishedAt,
		};
	});

	const comment = new Comment({
		id: topLevelComment.id,
		threadId: thread.id,
		text: topSnippet.textDisplay,
		author: buildAuthor(topSnippet),
		likeCount: topSnippet.likeCount,
		publishedAt: topSnippet.publishedAt,
		replyCount: thread.snippet.totalReplyCount || replies.length,
		replies,
	});

	return comment;
};

export { Comment, buildCommentFromThread };


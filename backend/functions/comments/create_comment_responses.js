import axios from "axios";

const DEFAULT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-nano";
const MAX_RESPONSES = 10;

const assertEnv = () => {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is required to generate comment responses");
	}
	return apiKey;
};

const pickRandomComments = (comments, limit) => {
	const uniqueComments = Array.from(
		new Map(
			(comments || [])
				.filter((comment) => comment && typeof comment === "object")
				.map((comment) => [comment.id ?? comment.commentId ?? null, comment])
		).values()
	).filter((comment) => comment?.id && typeof comment.text === "string" && comment.text.trim().length > 0);

	if (uniqueComments.length === 0) {
		return [];
	}

	const shuffled = uniqueComments
		.map((comment) => ({ comment, sortKey: Math.random() }))
		.sort((a, b) => a.sortKey - b.sortKey)
		.map(({ comment }) => comment);

	return shuffled.slice(0, limit);
};

const buildPrompt = (comments) => {
	const commentLines = comments
		.map(
			(comment, index) =>
				`${index + 1}. commentId: ${comment.id}\n   text: ${comment.text.trim()}\n   author: ${
					comment.author?.displayName ?? "Unknown"
				}`
		)
		.join("\n\n");

	return [
		{
			role: "system",
			content:
				"You craft warm, authentic YouTube comment replies that sound human, not corporate or robotic. Keep them concise and conversational.",
		},
		{
			role: "user",
			content: `Write thoughtful replies to these comments. Each response should feel personal, natural, and avoid generic phrases like "Thank you for your comment." You can reference the original text if it helps, but keep the tone friendly and relaxed.\n\nReturn only valid JSON mapping "commentId" -> "responseText". Do not include commentary or markdown.\n\nComments:\n${commentLines}`,
		},
	];
};

const parseJsonResponse = (text) => {
	if (!text || typeof text !== "string") {
		throw new Error("OpenAI response did not contain text output");
	}

	const trimmed = text.trim();
	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");

	if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
		throw new Error("OpenAI response did not return JSON");
	}

	const jsonSlice = trimmed.slice(firstBrace, lastBrace + 1);
	return JSON.parse(jsonSlice);
};

const createCommentResponses = async (comments, { maxResponses = MAX_RESPONSES } = {}) => {
	if (!Array.isArray(comments)) {
		throw new Error("comments must be an array");
	}

	const apiKey = assertEnv();
	const limit = Number.isFinite(maxResponses) && maxResponses > 0 ? Math.min(maxResponses, MAX_RESPONSES) : MAX_RESPONSES;
	const selectedComments = pickRandomComments(comments, limit);

	if (selectedComments.length === 0) {
		return {};
	}

	const messages = buildPrompt(selectedComments);

	try {
		const response = await axios.post(
			"https://api.openai.com/v1/chat/completions",
			{
				model: DEFAULT_MODEL,
				temperature: 0.7,
				max_tokens: 400,
				messages,
				response_format: { type: "json_object" },
			},
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				timeout: 15000,
			}
		);

		const content = response.data?.choices?.[0]?.message?.content;
		const parsed = parseJsonResponse(content);

		return Object.entries(parsed).reduce((acc, [commentId, reply]) => {
			const responseText = typeof reply === "string" ? reply.trim() : "";
			if (commentId && responseText) {
				acc[commentId] = responseText;
			}
			return acc;
		}, {});
	} catch (err) {
		const detail =
			err?.response?.data?.error?.message ||
			err?.response?.data?.error ||
			err?.response?.data ||
			err?.message ||
			err;
		throw new Error(`Failed to generate comment responses: ${JSON.stringify(detail)}`);
	}
};

export { createCommentResponses };
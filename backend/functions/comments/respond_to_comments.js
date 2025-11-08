import { google } from "googleapis";
import { buildOAuthClient } from "../../utils/googleOAuthClient.js";

const respondToComments = async (commentResponseMap, tokens) => {
	if (!commentResponseMap || typeof commentResponseMap !== "object" || Array.isArray(commentResponseMap)) {
		throw new Error("commentResponseMap must be an object mapping commentId -> responseText");
	}

	const entries = Object.entries(commentResponseMap).filter(
		([commentId, response]) => Boolean(commentId) && typeof response === "string" && response.trim().length > 0
	);

	if (entries.length === 0) {
		throw new Error("commentResponseMap must contain at least one commentId with a non-empty response");
	}

	const oauth2Client = buildOAuthClient(tokens);
	const youtube = google.youtube({ version: "v3", auth: oauth2Client });

	const successes = [];
	const failures = [];

	for (const [commentId, responseText] of entries) {
		try {
			const { data } = await youtube.comments.insert({
				part: ["snippet"],
				requestBody: {
					snippet: {
						parentId: commentId,
						textOriginal: responseText.trim(),
					},
				},
			});

			successes.push({
				commentId,
				replyId: data?.id ?? null,
				responseText: responseText.trim(),
			});
		} catch (err) {
			const errorMessage = err?.response?.data?.error?.message || err.message || "Unknown error";
			failures.push({
				commentId,
				responseText: responseText.trim(),
				error: errorMessage,
			});
		}
	}

	const credentials = oauth2Client.credentials ?? {};
	const updatedTokens = {
		accessToken: credentials.access_token ?? tokens?.accessToken ?? null,
		refreshToken: credentials.refresh_token ?? tokens?.refreshToken ?? null,
		scope: credentials.scope ?? tokens?.scope ?? null,
		tokenType: credentials.token_type ?? tokens?.tokenType ?? null,
		expiryDate: credentials.expiry_date ?? tokens?.expiryDate ?? null,
	};

	return {
		successes,
		failures,
		updatedTokens,
	};
};

export { respondToComments };
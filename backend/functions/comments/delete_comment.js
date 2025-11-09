import { google } from "googleapis";
import { buildOAuthClient } from "../../utils/googleOAuthClient.js";

const deleteComment = async (commentId, tokens) => {
	if (!commentId || typeof commentId !== "string") {
		throw new Error("commentId is required");
	}

	const oauth2Client = buildOAuthClient(tokens);
	const youtube = google.youtube({ version: "v3", auth: oauth2Client });

	try {
		await youtube.comments.delete({ id: commentId });
	} catch (err) {
		const message = err?.response?.data?.error?.message || err.message || "Failed to delete comment";
		throw new Error(message);
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
		success: true,
		updatedTokens,
	};
};

export { deleteComment };
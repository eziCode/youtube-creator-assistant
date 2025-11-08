import { google } from "googleapis";

const REQUIRED_ENV_VARS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];

const validateEnv = () => {
	const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
	if (missing.length > 0) {
		throw new Error(`Missing required Google OAuth environment variables: ${missing.join(", ")}`);
	}
};

const buildOAuthClient = (tokens) => {
	validateEnv();

	const oauth2Client = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI
	);

	const cleanedTokens = {
		access_token: tokens?.accessToken ?? tokens?.access_token ?? null,
		refresh_token: tokens?.refreshToken ?? tokens?.refresh_token ?? null,
		scope: tokens?.scope ?? null,
		token_type: tokens?.tokenType ?? tokens?.token_type ?? null,
		expiry_date: tokens?.expiryDate
			? typeof tokens.expiryDate === "number"
				? tokens.expiryDate
				: new Date(tokens.expiryDate).getTime()
			: tokens?.expiry_date ?? null,
	};

	if (!cleanedTokens.access_token) {
		throw new Error("Access token is required to respond to comments");
	}

	oauth2Client.setCredentials(cleanedTokens);
	return oauth2Client;
};

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
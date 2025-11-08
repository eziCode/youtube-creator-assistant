import { google } from "googleapis";

const REQUIRED_ENV_VARS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];

const validateEnv = () => {
	const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
	if (missing.length > 0) {
		throw new Error(`Missing required Google OAuth environment variables: ${missing.join(", ")}`);
	}
};

const buildOAuthClient = (tokens = {}) => {
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
		expiry_date:
			tokens?.expiryDate != null
				? typeof tokens.expiryDate === "number"
					? tokens.expiryDate
					: new Date(tokens.expiryDate).getTime()
				: tokens?.expiry_date ?? null,
		id_token: tokens?.idToken ?? tokens?.id_token ?? null,
	};

	if (!cleanedTokens.access_token) {
		throw new Error("Access token is required to call Google APIs");
	}

	oauth2Client.setCredentials(cleanedTokens);
	return oauth2Client;
};

export { buildOAuthClient, validateEnv };


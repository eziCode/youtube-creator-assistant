import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const router = express.Router();

const requiredEnvVars = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "FRONTEND_URL",
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.warn(`[auth] Environment variable ${envVar} is not set.`);
    }
}

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/youtube.readonly",
];

router.get("/google", (req, res) => {
    try {
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: scopes,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        });
        res.redirect(url);
    } catch (err) {
        console.error("[auth] Failed to generate Google auth URL", err);
        res.status(500).json({ error: "Failed to initiate Google OAuth flow." });
    }
});

router.get("/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ error: "Authorization code not provided." });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        const url = new URL(`${frontendUrl.replace(/\/$/, "")}/auth/success`);
        url.searchParams.set("access_token", tokens.access_token ?? "");
        url.searchParams.set("refresh_token", tokens.refresh_token ?? "");
        url.searchParams.set("scope", tokens.scope ?? "");
        url.searchParams.set(
            "expiry_date",
            tokens.expiry_date ? String(tokens.expiry_date) : ""
        );
        url.searchParams.set("token_type", tokens.token_type ?? "");
        url.searchParams.set("id_token", tokens.id_token ?? "");
        url.searchParams.set("email", userInfo.email ?? "");
        url.searchParams.set("name", userInfo.name ?? "");

        res.redirect(url.toString());
    } catch (err) {
        console.error("[auth] OAuth callback failed", err);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const errorUrl = new URL(`${frontendUrl.replace(/\/$/, "")}/auth/error`);
        errorUrl.searchParams.set(
            "message",
            err instanceof Error ? err.message : "Unknown authentication error."
        );
        res.redirect(errorUrl.toString());
    }
});

export default router;


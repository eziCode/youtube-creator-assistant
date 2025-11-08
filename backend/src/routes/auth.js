import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import User from "../models/User.js";

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
    "https://www.googleapis.com/auth/youtube.force-ssl",
];

const buildFrontendUrl = (path) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    return new URL(`${frontendUrl.replace(/\/$/, "")}${path}`);
};

const regenerateSession = (req) =>
    new Promise((resolve, reject) => {
        if (!req.session) {
            reject(new Error("Session middleware not configured"));
            return;
        }

        req.session.regenerate((err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });

const saveSession = (req) =>
    new Promise((resolve, reject) => {
        if (!req.session) {
            reject(new Error("Session middleware not configured"));
            return;
        }

        req.session.save((err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });

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

        if (!userInfo?.id) {
            throw new Error("Unable to retrieve Google user id");
        }

        let user = await User.findOne({ googleId: userInfo.id });
        if (!user) {
            user = new User({ googleId: userInfo.id });
        }

        user.email = userInfo.email ?? user.email;
        user.name = userInfo.name ?? user.name;
        user.picture = userInfo.picture ?? user.picture;
        user.locale = userInfo.locale ?? user.locale;
        user.lastLoginAt = new Date();

        if (!user.tokens) {
            user.tokens = {};
        }

        if (tokens.access_token) {
            user.tokens.accessToken = tokens.access_token;
        }

        if (tokens.refresh_token) {
            user.tokens.refreshToken = tokens.refresh_token;
        }

        if (tokens.scope) {
            user.tokens.scope = tokens.scope;
        }

        if (tokens.token_type) {
            user.tokens.tokenType = tokens.token_type;
        }

        if (tokens.expiry_date) {
            user.tokens.expiryDate = new Date(tokens.expiry_date);
        }

        if (tokens.id_token) {
            user.tokens.idToken = tokens.id_token;
        }

        await user.save();

        const sessionUser = {
            id: user._id.toString(),
            googleId: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture,
        };

        const sessionTokens = {
            accessToken: tokens.access_token ?? user.tokens?.accessToken ?? null,
            refreshToken: tokens.refresh_token ?? user.tokens?.refreshToken ?? null,
            scope: tokens.scope ?? user.tokens?.scope ?? null,
            tokenType: tokens.token_type ?? user.tokens?.tokenType ?? null,
            expiryDate:
                tokens.expiry_date ??
                (user.tokens?.expiryDate ? user.tokens.expiryDate.getTime() : null),
        };

        await regenerateSession(req);
        req.session.user = sessionUser;
        req.session.tokens = sessionTokens;
        await saveSession(req);

        const successUrl = buildFrontendUrl("/auth/success");
        successUrl.searchParams.set("auth", "success");

        res.redirect(successUrl.toString());
    } catch (err) {
        console.error("[auth] OAuth callback failed", err);
        const errorUrl = buildFrontendUrl("/auth/error");
        errorUrl.searchParams.set(
            "message",
            err instanceof Error ? err.message : "Unknown authentication error."
        );
        res.redirect(errorUrl.toString());
    }
});

router.get("/session", (req, res) => {
    if (!req.session?.user) {
        return res.status(200).json({ authenticated: false });
    }

    return res.status(200).json({
        authenticated: true,
        user: req.session.user,
    });
});

router.post("/logout", async (req, res) => {
    const sessionCookieName = req.app.get("sessionCookieName") || "connect.sid";
    const sameSite = req.app.get("sessionCookieSameSite") || "lax";
    const secure = Boolean(req.app.get("sessionCookieSecure"));

    const clearCookie = () => {
        res.clearCookie(sessionCookieName, {
            httpOnly: true,
            sameSite,
            secure,
            path: "/",
        });
    };

    if (!req.session) {
        clearCookie();
        return res.status(200).json({ success: true });
    }

    req.session.tokens = undefined;
    req.session.user = undefined;

    req.session.destroy((err) => {
        if (err) {
            console.error("[auth] Failed to destroy session", err);
            return res.status(500).json({ error: "Failed to log out" });
        }

        clearCookie();
        return res.status(200).json({ success: true });
    });
});

export default router;


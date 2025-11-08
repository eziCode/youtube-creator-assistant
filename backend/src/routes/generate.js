import express from "express";
import { getOAuth2Client, getChannelVideos, getTrendingVideos } from "../../src/models/youtube.js";
import { generateVideoContent } from "../../src/models/llm.js";
import { generateThumbnail } from "../../src/models/thumbnail.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { channelId } = req.body;
        if (!channelId) return res.status(400).json({ error: "channelId required" });
        console.log("/generate called; session tokens:", req.session?.tokens);

        const oauth2Client = await getOAuth2Client(req.session?.tokens);
        console.log("OAuth2 client credentials:", oauth2Client.credentials);

        let channelVideos = [];
        try {
            channelVideos = await getChannelVideos(oauth2Client, channelId);
            console.log(`Fetched ${channelVideos.length} channel videos`);
        } catch (err) {
            console.error("Error calling getChannelVideos:", err?.message || err, err?.stack || "");
            return res.status(500).json({ error: "Failed to fetch channel videos", details: err?.message || String(err) });
        }

        let trendingVideos = [];
        try {
            trendingVideos = await getTrendingVideos(oauth2Client);
            console.log(`Fetched ${trendingVideos.length} trending videos`);
        } catch (err) {
            console.error("Error calling getTrendingVideos:", err?.message || err, err?.stack || "");
            return res.status(500).json({ error: "Failed to fetch trending videos", details: err?.message || String(err) });
        }

        let llmOutput = "";
        try {
            llmOutput = await generateVideoContent(channelVideos, trendingVideos);
            console.log("LLM output length:", llmOutput?.length || 0);
        } catch (err) {
            console.error("Error calling generateVideoContent:", err?.message || err, err?.stack || "");
            return res.status(500).json({ error: "Failed to generate LLM content", details: err?.message || String(err) });
        }

        const thumbnailPrompt =
            llmOutput.match(/Thumbnail prompt:(.*)/i)?.[1]?.trim() || "Creative YouTube thumbnail";

        let thumbnailPath = "./thumbnail.png";
        let thumbnailFallback = false;
        try {
            await generateThumbnail(thumbnailPrompt, thumbnailPath);
            console.log("Thumbnail generated");
        } catch (err) {
            console.error("Error calling generateThumbnail:", err?.message || err, err?.stack || "");
            // Instead of failing the whole request, return a lightweight SVG placeholder as a data URI
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                `<rect width='100%' height='100%' fill='#111827'/>` +
                `<text x='50%' y='45%' fill='#ffffff' font-size='40' font-family='sans-serif' text-anchor='middle'>Thumbnail generation unavailable</text>` +
                `<text x='50%' y='60%' fill='#9ca3af' font-size='28' font-family='sans-serif' text-anchor='middle'>${thumbnailPrompt.replace(/</g, '&lt;').slice(0, 120)}</text>` +
                `</svg>`;

            const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
            thumbnailPath = dataUri;
            thumbnailFallback = true;
            console.warn("Using SVG thumbnail fallback (data URI)");
        }

        res.json({
            llm_output: llmOutput,
            thumbnail_prompt: thumbnailPrompt,
            thumbnail_path: thumbnailPath,
            thumbnail_fallback: thumbnailFallback,
        });
    } catch (err) {
        console.error("Error in /generate:", err);
        if (err.response) {
            console.error("Response data:", err.response.data);
        }
        res.status(500).json({ error: "Failed to generate content", details: err.message });
    }
});
export default router;

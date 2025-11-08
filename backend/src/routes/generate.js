import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
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

        // If LLM returned an object with videos (normalized in llm.js), generate thumbnails per idea
        if (llmOutput && typeof llmOutput === "object" && Array.isArray(llmOutput.videos)) {
            const videos = [];

            for (let i = 0; i < llmOutput.length; i++) {
                const item = llmOutput[i];
                const title = item.title || `Generated Video ${i + 1}`;
                const script = item.script || "";
                const thumbPrompt = item.thumbnail_prompt || "Creative YouTube thumbnail";

                // Generate thumbnail to a temp file, then convert to data URI for frontend
                const tmpPath = path.join(os.tmpdir(), `yca_thumb_${Date.now()}_${i}.png`);
                let thumbDataUri = null;
                let thumbFallback = false;

                try {
                    await generateThumbnail(thumbPrompt, tmpPath);

                    if (fs.existsSync(tmpPath)) {
                        const buff = fs.readFileSync(tmpPath);
                        thumbDataUri = `data:image/png;base64,${buff.toString("base64")}`;
                        // remove temp file
                        try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
                    } else {
                        throw new Error("Thumbnail file not created");
                    }
                } catch (err) {
                    console.error(`Error generating thumbnail for idea ${i + 1}:`, err?.message || err);
                    // Fallback to SVG data URI
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                        `<rect width='100%' height='100%' fill='#111827'/>` +
                        `<text x='50%' y='45%' fill='#ffffff' font-size='40' font-family='sans-serif' text-anchor='middle'>Thumbnail generation unavailable</text>` +
                        `<text x='50%' y='60%' fill='#9ca3af' font-size='28' font-family='sans-serif' text-anchor='middle'>${thumbPrompt.replace(/</g, '&lt;').slice(0, 120)}</text>` +
                        `</svg>`;

                    thumbDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
                    thumbFallback = true;
                }

                videos.push({
                    id: item.id || `generated-${i + 1}`,
                    title,
                    script,
                    thumbnail_prompt: thumbPrompt,
                    thumbnail_path: thumbDataUri,
                    thumbnail_fallback: thumbFallback,
                });
            }

            return res.json({ videos, channel_focus: llmOutput.channel_focus || "" });
        }

        // If LLM returned an array directly (older behavior), handle that as well
        if (Array.isArray(llmOutput)) {
            const videos = [];

            for (let i = 0; i < llmOutput.length; i++) {
                const item = llmOutput[i];
                const title = item.title || `Generated Video ${i + 1}`;
                const script = item.script || "";
                const thumbPrompt = item.thumbnail_prompt || "Creative YouTube thumbnail";

                // Generate thumbnail to a temp file, then convert to data URI for frontend
                const tmpPath = path.join(os.tmpdir(), `yca_thumb_${Date.now()}_${i}.png`);
                let thumbDataUri = null;
                let thumbFallback = false;

                try {
                    await generateThumbnail(thumbPrompt, tmpPath);

                    if (fs.existsSync(tmpPath)) {
                        const buff = fs.readFileSync(tmpPath);
                        thumbDataUri = `data:image/png;base64,${buff.toString("base64")}`;
                        // remove temp file
                        try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
                    } else {
                        throw new Error("Thumbnail file not created");
                    }
                } catch (err) {
                    console.error(`Error generating thumbnail for idea ${i + 1}:`, err?.message || err);
                    // Fallback to SVG data URI
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                        `<rect width='100%' height='100%' fill='#111827'/>` +
                        `<text x='50%' y='45%' fill='#ffffff' font-size='40' font-family='sans-serif' text-anchor='middle'>Thumbnail generation unavailable</text>` +
                        `<text x='50%' y='60%' fill='#9ca3af' font-size='28' font-family='sans-serif' text-anchor='middle'>${thumbPrompt.replace(/</g, '&lt;').slice(0, 120)}</text>` +
                        `</svg>`;

                    thumbDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
                    thumbFallback = true;
                }

                videos.push({
                    id: item.id || `generated-${i + 1}`,
                    title,
                    script,
                    thumbnail_prompt: thumbPrompt,
                    thumbnail_path: thumbDataUri,
                    thumbnail_fallback: thumbFallback,
                });
            }

            return res.json({ videos });
        }

        // Otherwise return legacy single-output response
        const thumbnailPrompt =
            (typeof llmOutput === 'string' && llmOutput.match(/Thumbnail prompt:(.*)/i)?.[1]?.trim()) || "Creative YouTube thumbnail";

        let thumbnailPath = "./thumbnail.png";
        let thumbnailFallback = false;
        try {
            await generateThumbnail(thumbnailPrompt, thumbnailPath);
            console.log("Thumbnail generated");
            // convert saved file to data URI
            if (fs.existsSync(thumbnailPath)) {
                const buff = fs.readFileSync(thumbnailPath);
                thumbnailPath = `data:image/png;base64,${buff.toString("base64")}`;
                try { fs.unlinkSync('./thumbnail.png'); } catch (e) { /* ignore */ }
            }
        } catch (err) {
            console.error("Error calling generateThumbnail:", err?.message || err, err?.stack || "");
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

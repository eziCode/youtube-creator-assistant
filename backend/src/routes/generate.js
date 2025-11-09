import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { getOAuth2Client, getChannelVideos, getTrendingVideos } from "../../src/models/youtube.js";
import { generateVideoContent } from "../../src/models/llm.js";
import { generateThumbnail } from "../../src/models/thumbnail.js";
import crypto from "crypto";

const router = express.Router();

// In-memory cache for thumbnails (key: thumbnailId, value: { dataUri, ready })
const thumbnailCache = new Map();

// Ensure CORS headers for this route in case global CORS was not applied.
router.use((req, res, next) => {
    const origin = req.get('Origin') || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    next();
});

// Handle preflight
router.options('/', (req, res) => {
    res.sendStatus(204);
});

router.post("/", async (req, res) => {
    try {
    const { channelId } = req.body;
    const uploadedImageData = req.body?.uploadedImage || null;
        if (!channelId) return res.status(400).json({ error: "channelId required" });
        console.log("/generate called; session tokens:", req.session?.tokens);

        const oauth2Client = await getOAuth2Client(req.session?.tokens);
        console.log("OAuth2 client credentials:", oauth2Client.credentials);

        let channelVideos = [];
        const useSample = req.body?.useSample || req.query?.useSample === '1' || process.env.USE_SAMPLE_DATA === 'true';

        if (useSample) {
            console.log("/generate: using sample channelVideos/trendingVideos (skip YouTube API)");
            // Provide realistic channel video items that mirror YouTube API snippet/statistics shape
            channelVideos = [
                {
                    id: { kind: "youtube#video", videoId: "sample1" },
                    snippet: {
                        title: "How I Built a Solar-Powered Water Purifier | DIY Science",
                        channelTitle: "YourChannelName",
                        publishedAt: "2025-09-10T09:00:00Z",
                        description: "A step-by-step build of an affordable, solar-powered water purifier for small communities."
                    },
                    statistics: { viewCount: "45234" }
                },
                {
                    id: { kind: "youtube#video", videoId: "sample2" },
                    snippet: {
                        title: "Obstacle-Avoiding Rover — Complete Build & Code Walkthrough",
                        channelTitle: "YourChannelName",
                        publishedAt: "2025-08-02T14:30:00Z",
                        description: "Building a competition-ready rover with sensors and autonomous navigation. Includes code and parts list."
                    },
                    statistics: { viewCount: "78321" }
                },
                {
                    id: { kind: "youtube#video", videoId: "sample3" },
                    snippet: {
                        title: "LED Spectrum Effects on Plant Growth — Month 3 Results",
                        channelTitle: "YourChannelName",
                        publishedAt: "2025-07-18T07:15:00Z",
                        description: "An experimental study comparing different LED spectrums on common houseplants over 90 days."
                    },
                    statistics: { viewCount: "32910" }
                }
            ];
        } else {
            try {
                channelVideos = await getChannelVideos(oauth2Client, channelId);
                console.log(`Fetched ${channelVideos.length} channel videos`);
            } catch (err) {
                console.error("Error calling getChannelVideos:", err?.message || err, err?.stack || "");
                // Provide richer diagnostic info but avoid exposing secrets
                const diagnostic = {
                    message: err?.message || String(err)
                };
                if (err?.errors) diagnostic.errors = err.errors;
                if (err?.code) diagnostic.code = err.code;
                if (err?.response?.data) diagnostic.responseData = err.response.data;
                return res.status(500).json({ error: "Failed to fetch channel videos", details: diagnostic });
            }
        }

        let trendingVideos = [];
        if (useSample) {
            console.log("/generate: using sample trendingVideos (skip YouTube API)");
            // Provide realistic-looking trending items similar to YouTube's trending snippet/statistics shape
            trendingVideos = [
                {
                    id: { kind: "youtube#video", videoId: "trending1" },
                    snippet: {
                        title: "10 AI Tools Every Creator Should Know",
                        channelTitle: "TechGuru",
                        publishedAt: "2025-10-20T12:34:56Z",
                        description: "A roundup of AI tools that speed up editing, scripting, and thumbnails."
                    },
                    statistics: { viewCount: "1534000" }
                },
                {
                    id: { kind: "youtube#video", videoId: "trending2" },
                    snippet: {
                        title: "I let AI edit my video — here's what happened",
                        channelTitle: "CreatorLab",
                        publishedAt: "2025-11-01T08:00:00Z",
                        description: "Experimenting with AI video editors and reviewing the results."
                    },
                    statistics: { viewCount: "2345000" }
                },
                {
                    id: { kind: "youtube#video", videoId: "trending3" },
                    snippet: {
                        title: "Viral Short: 5 Tips to Grow on YouTube in 2025",
                        channelTitle: "GrowthHacks",
                        publishedAt: "2025-11-05T16:20:00Z",
                        description: "Quick, actionable tips for creators to grow views and subscribers."
                    },
                    statistics: { viewCount: "987000" }
                }
            ];
        } else {
            try {
                trendingVideos = await getTrendingVideos(oauth2Client);
                console.log(`Fetched ${trendingVideos.length} trending videos`);
            } catch (err) {
                console.error("Error calling getTrendingVideos:", err?.message || err, err?.stack || "");
                return res.status(500).json({ error: "Failed to fetch trending videos", details: err?.message || String(err) });
            }
        }

        // Accept uploadedImagePath returned from the multipart upload endpoint.
        // The frontend should first POST the file to /upload-image and then
        // provide the returned path here as `uploadedImagePath`.
        let uploadedImagePath = null;
        const providedUploadedPath = req.body?.uploadedImagePath || req.body?.uploadedImagePath?.path || null;
        if (providedUploadedPath && typeof providedUploadedPath === 'string') {
            if (fs.existsSync(providedUploadedPath)) {
                uploadedImagePath = providedUploadedPath;
                console.log('/generate: using uploaded image path', uploadedImagePath);
            } else {
                console.warn('/generate: provided uploadedImagePath does not exist on disk:', providedUploadedPath);
            }
        }

        // Normalize channel/trending shapes to a simple {id, title} array so the LLM prompt
        // receives consistent data (our sample data uses snippet.title while live API
        // may provide a different top-level shape).
        const normalizedChannelVideos = channelVideos.map(cv => ({
            id: (cv?.id && (cv.id.videoId || cv.id)) || cv?.id || cv?.videoId || null,
            title: cv?.snippet?.title || cv?.title || ""
        }));

        const normalizedTrendingVideos = trendingVideos.map(tv => ({
            id: (tv?.id && (tv.id.videoId || tv.id)) || tv?.id || tv?.videoId || null,
            title: tv?.snippet?.title || tv?.title || ""
        }));

        let llmOutput = "";
        try {
            console.log("Calling LLM with", { channelCount: normalizedChannelVideos.length, trendingCount: normalizedTrendingVideos.length });
            llmOutput = await generateVideoContent(normalizedChannelVideos, normalizedTrendingVideos);
            console.log("LLM output length:", (llmOutput && typeof llmOutput === 'string') ? llmOutput.length : (llmOutput?.videos?.length || 0));
        } catch (err) {
            console.error("Error calling generateVideoContent:", err?.message || err, err?.stack || "");
            return res.status(500).json({ error: "Failed to generate LLM content", details: err?.message || String(err) });
        }

        // If LLM returned an object with videos (normalized in llm.js), return videos immediately and generate thumbnails async
        if (llmOutput && typeof llmOutput === "object" && Array.isArray(llmOutput.videos)) {
            const videos = [];

            // Return videos immediately with thumbnailId (thumbnails will be generated async)
            for (let i = 0; i < llmOutput.videos.length; i++) {
                const item = llmOutput.videos[i];
                const title = item.title || `Generated Video ${i + 1}`;
                const script = item.script || "";
                const thumbPrompt = item.thumbnail_prompt || "Creative YouTube thumbnail";
                const thumbnailId = crypto.randomBytes(16).toString('hex');

                // Initialize cache entry as loading
                thumbnailCache.set(thumbnailId, { ready: false, dataUri: null, fallback: false });

                // Generate thumbnail asynchronously
                (async () => {
                    const tmpPath = path.join(os.tmpdir(), `yca_thumb_${Date.now()}_${i}_${thumbnailId}.png`);
                    try {
                        await generateThumbnail(thumbPrompt, tmpPath, uploadedImagePath);

                        if (fs.existsSync(tmpPath)) {
                            const buff = fs.readFileSync(tmpPath);
                            let mime = 'image/png';
                            try {
                                const asText = buff.toString('utf8').trim();
                                if (asText.startsWith('<svg') || asText.includes('<svg')) {
                                    mime = 'image/svg+xml';
                                }
                            } catch (e) {}
                            const thumbDataUri = `data:${mime};base64,${buff.toString("base64")}`;
                            thumbnailCache.set(thumbnailId, { ready: true, dataUri: thumbDataUri, fallback: false });
                            try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
                        } else {
                            throw new Error("Thumbnail file not created");
                        }
                    } catch (err) {
                        console.error(`Error generating thumbnail for idea ${i + 1}:`, err?.message || err);
                        // Create SVG fallback
                        let svg;
                        try {
                            const uploadedB64 = uploadedImagePath && fs.existsSync(uploadedImagePath) ? fs.readFileSync(uploadedImagePath).toString('base64') : null;
                            if (uploadedB64) {
                                svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                                    `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#0f172a'/><stop offset='1' stop-color='#111827'/></linearGradient></defs>` +
                                    `<rect width='100%' height='100%' fill='url(#g)'/>` +
                                    `<image href='data:image/*;base64,${uploadedB64}' x='50' y='40' width='700' height='595' preserveAspectRatio='xMidYMid slice'/>` +
                                    `<rect x='50' y='460' width='700' height='175' fill='rgba(0,0,0,0.45)'/>` +
                                    `<text x='80' y='520' fill='#fff' font-size='44' font-family='sans-serif' font-weight='700'>${escapeXml(thumbPrompt).slice(0,80)}</text>` +
                                    `<text x='80' y='570' fill='#d1d5db' font-size='28' font-family='sans-serif'>${escapeXml(thumbPrompt).slice(80,200)}</text>` +
                                    `</svg>`;
                            } else {
                                svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                                    `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#111827'/><stop offset='1' stop-color='#0b1220'/></linearGradient></defs>` +
                                    `<rect width='100%' height='100%' fill='url(#g)'/>` +
                                    `<text x='50%' y='38%' fill='#fff' font-size='48' font-family='sans-serif' font-weight='700' text-anchor='middle'>${escapeXml(thumbPrompt).slice(0,80)}</text>` +
                                    `<text x='50%' y='50%' fill='#9ca3af' font-size='28' font-family='sans-serif' text-anchor='middle'>${escapeXml(thumbPrompt).slice(80,200)}</text>` +
                                    `</svg>`;
                            }
                            const thumbDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
                            thumbnailCache.set(thumbnailId, { ready: true, dataUri: thumbDataUri, fallback: true });
                        } catch (svgErr) {
                            console.error('Failed to create SVG fallback:', svgErr);
                            const fallback = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'><rect width='100%' height='100%' fill='#111827'/></svg>`;
                            const thumbDataUri = `data:image/svg+xml;base64,${Buffer.from(fallback).toString('base64')}`;
                            thumbnailCache.set(thumbnailId, { ready: true, dataUri: thumbDataUri, fallback: true });
                        }
                    }
                })();

                videos.push({
                    id: item.id || `generated-${i + 1}`,
                    title,
                    script,
                    thumbnailPrompt: thumbPrompt,
                    thumbnailId: thumbnailId,
                    thumbnailPath: null, // Will be fetched via /thumbnail/:id
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
                    await generateThumbnail(thumbPrompt, tmpPath, uploadedImagePath);

                    if (fs.existsSync(tmpPath)) {
                            const buff = fs.readFileSync(tmpPath);
                            let mime = 'image/png';
                            try {
                                const asText = buff.toString('utf8').trim();
                                if (asText.startsWith('<svg') || asText.includes('<svg')) {
                                    mime = 'image/svg+xml';
                                }
                            } catch (e) {}
                            thumbDataUri = `data:${mime};base64,${buff.toString("base64")}`;
                            // remove temp file
                            try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
                        } else {
                            throw new Error("Thumbnail file not created");
                        }
                } catch (err) {
                    console.error(`Error generating thumbnail for idea ${i + 1}:`, err?.message || err);
                    // Construct a nicer SVG fallback. If an uploaded image exists, use
                    // it prominently; otherwise render a styled prompt card.
                    let svg;
                    try {
                        const uploadedB64 = uploadedImagePath && fs.existsSync(uploadedImagePath) ? fs.readFileSync(uploadedImagePath).toString('base64') : null;
                        if (uploadedB64) {
                            svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                                `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#0f172a'/><stop offset='1' stop-color='#111827'/></linearGradient></defs>` +
                                `<rect width='100%' height='100%' fill='url(#g)'/>` +
                                `<image href='data:image/*;base64,${uploadedB64}' x='50' y='40' width='700' height='595' preserveAspectRatio='xMidYMid slice'/>` +
                                `<rect x='50' y='460' width='700' height='175' fill='rgba(0,0,0,0.45)'/>` +
                                `<text x='80' y='520' fill='#fff' font-size='44' font-family='sans-serif' font-weight='700'>${escapeXml(thumbPrompt).slice(0,80)}</text>` +
                                `<text x='80' y='570' fill='#d1d5db' font-size='28' font-family='sans-serif'>${escapeXml(thumbPrompt).slice(80,200)}</text>` +
                                `</svg>`;
                        } else {
                            svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                                `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#111827'/><stop offset='1' stop-color='#0b1220'/></linearGradient></defs>` +
                                `<rect width='100%' height='100%' fill='url(#g)'/>` +
                                `<text x='50%' y='38%' fill='#fff' font-size='48' font-family='sans-serif' font-weight='700' text-anchor='middle'>${escapeXml(thumbPrompt).slice(0,80)}</text>` +
                                `<text x='50%' y='50%' fill='#9ca3af' font-size='28' font-family='sans-serif' text-anchor='middle'>${escapeXml(thumbPrompt).slice(80,200)}</text>` +
                                `</svg>`;
                        }
                        thumbDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
                        thumbFallback = true;
                    } catch (svgErr) {
                        console.error('Failed to create SVG fallback:', svgErr);
                        const fallback = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'><rect width='100%' height='100%' fill='#111827'/></svg>`;
                        thumbDataUri = `data:image/svg+xml;base64,${Buffer.from(fallback).toString('base64')}`;
                        thumbFallback = true;
                    }
                }

                videos.push({
                    id: item.id || `generated-${i + 1}`,
                    title,
                    script,
                    thumbnailPrompt: thumbPrompt,
                    thumbnailPath: thumbDataUri,
                    thumbnailFallback: thumbFallback,
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
            await generateThumbnail(thumbnailPrompt, thumbnailPath, uploadedImagePath);
            console.log("Thumbnail generated");
            // convert saved file to data URI
            if (fs.existsSync(thumbnailPath)) {
                const buff = fs.readFileSync(thumbnailPath);
                let mime = 'image/png';
                try {
                    const asText = buff.toString('utf8').trim();
                    if (asText.startsWith('<svg') || asText.includes('<svg')) {
                        mime = 'image/svg+xml';
                    }
                } catch (e) {}
                thumbnailPath = `data:${mime};base64,${buff.toString("base64")}`;
                try { fs.unlinkSync('./thumbnail.png'); } catch (e) { /* ignore */ }
            }
        } catch (err) {
            console.error("Error calling generateThumbnail:", err?.message || err, err?.stack || "");
                try {
                    const uploadedB64 = uploadedImagePath && fs.existsSync(uploadedImagePath) ? fs.readFileSync(uploadedImagePath).toString('base64') : null;
                    let svg;
                    if (uploadedB64) {
                        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                            `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#0f172a'/><stop offset='1' stop-color='#111827'/></linearGradient></defs>` +
                            `<rect width='100%' height='100%' fill='url(#g)'/>` +
                            `<image href='data:image/*;base64,${uploadedB64}' x='50' y='40' width='700' height='595' preserveAspectRatio='xMidYMid slice'/>` +
                            `<rect x='50' y='460' width='700' height='175' fill='rgba(0,0,0,0.45)'/>` +
                            `<text x='80' y='520' fill='#fff' font-size='44' font-family='sans-serif' font-weight='700'>${escapeXml(thumbnailPrompt).slice(0,80)}</text>` +
                            `<text x='80' y='570' fill='#d1d5db' font-size='28' font-family='sans-serif'>${escapeXml(thumbnailPrompt).slice(80,200)}</text>` +
                            `</svg>`;
                    } else {
                        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'>` +
                            `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='#111827'/><stop offset='1' stop-color='#0b1220'/></linearGradient></defs>` +
                            `<rect width='100%' height='100%' fill='url(#g)'/>` +
                            `<text x='50%' y='38%' fill='#fff' font-size='48' font-family='sans-serif' font-weight='700' text-anchor='middle'>${escapeXml(thumbnailPrompt).slice(0,80)}</text>` +
                            `<text x='50%' y='50%' fill='#9ca3af' font-size='28' font-family='sans-serif' text-anchor='middle'>${escapeXml(thumbnailPrompt).slice(80,200)}</text>` +
                            `</svg>`;
                    }

                    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
                    thumbnailPath = dataUri;
                    thumbnailFallback = true;
                    console.warn("Using SVG thumbnail fallback (data URI)");
                } catch (svgErr) {
                    console.error('Failed to create SVG fallback:', svgErr);
                    const fallback = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'><rect width='100%' height='100%' fill='#111827'/></svg>`;
                    thumbnailPath = `data:image/svg+xml;base64,${Buffer.from(fallback).toString('base64')}`;
                    thumbnailFallback = true;
                }
        }

        res.json({
            llm_output: llmOutput,
            thumbnailPrompt: thumbnailPrompt,
            thumbnailPath: thumbnailPath,
            thumbnailFallback: thumbnailFallback,
        });
    } catch (err) {
        console.error("Error in /generate:", err);
        if (err.response) {
            console.error("Response data:", err.response.data);
        }
        res.status(500).json({ error: "Failed to generate content", details: err.message });
    }
});

// Endpoint to fetch thumbnail by ID
router.get("/thumbnail/:id", (req, res) => {
    const { id } = req.params;
    const cached = thumbnailCache.get(id);
    
    if (!cached) {
        return res.status(404).json({ error: "Thumbnail not found" });
    }
    
    if (!cached.ready) {
        return res.json({ ready: false });
    }
    
    return res.json({ 
        ready: true, 
        dataUri: cached.dataUri,
        fallback: cached.fallback 
    });
});

function escapeXml(unsafe) {
    return (unsafe || '').replace(/[<>&"']/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
}

export default router;

import express from "express";
import { getOAuth2Client, getChannelVideos, getTrendingVideos } from "../../src/models/youtube.js";
import { generateVideoContent } from "../../src/models/llm.js";
import { generateThumbnail } from "../../src/models/thumbnail.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { channelId } = req.body;
        if (!channelId) return res.status(400).json({ error: "channelId required" });

        const oauth2Client = await getOAuth2Client();
        console.log("OAuth2 client obtained");

        const channelVideos = await getChannelVideos(oauth2Client, channelId);
        console.log("Channel videos:", channelVideos);

        const trendingVideos = await getTrendingVideos(oauth2Client);
        console.log("Trending videos:", trendingVideos);

        const llmOutput = await generateVideoContent(channelVideos, trendingVideos);
        console.log("LLM output:", llmOutput);

        const thumbnailPrompt =
            llmOutput.match(/Thumbnail prompt:(.*)/i)?.[1]?.trim() || "Creative YouTube thumbnail";

        const thumbnailPath = "./thumbnail.png";
        await generateThumbnail(thumbnailPrompt, thumbnailPath);
        console.log("Thumbnail generated");

        res.json({
            llm_output: llmOutput,
            thumbnail_prompt: thumbnailPrompt,
            thumbnail_path: thumbnailPath,
        });
    } catch (err) {
        console.error("Error in /generate route:", err);
        // Send real error message to frontend for debugging
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
export default router;

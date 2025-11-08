import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { retrieveComments } from "../functions/comments/retrieve_comments.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(express.json());
app.use(
    cors({
        origin: FRONTEND_ORIGIN,
        credentials: true,
    })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.use("/auth", authRouter);

app.get("/retrieve-comments", async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: "videoId query param required" });

    try {
        const comments = await retrieveComments(videoId);
        return res.json({ comments });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'failed to retrieve comments' });
    }
});
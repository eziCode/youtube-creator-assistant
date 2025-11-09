import { getGeminiModel } from "../../utils/gemini.js";

const VALID_TONES = new Set(["Friendly", "Professional", "Comedic", "Sarcastic"]);

const sanitize = (value = "") => value.replace(/\s+/g, " ").trim();

const buildPrompt = ({ commentText, viewerName, tone, videoTitle }) => {
	const viewer = viewerName ? `from ${viewerName}` : "";
	const videoContext = videoTitle ? `Focus on the context of the video titled "${videoTitle}".` : "";
	return [
		"You are an assistant helping a YouTube creator craft replies to comments.",
		"Respond in under 80 words, keep the requested tone, and stay positive.",
		"Do not add markdown, hashtags, or links unless asked.",
		videoContext,
		`Tone: ${tone}.`,
		`Comment ${viewer}: "${commentText}"`,
		"Provide only the reply text.",
	]
		.filter(Boolean)
		.join("\n");
};

const generateCommentReply = async ({ commentText, tone, viewerName, videoTitle }) => {
	const cleanedComment = sanitize(commentText);
	if (!cleanedComment) {
		throw new Error("commentText must be provided");
	}

	const normalizedTone = VALID_TONES.has(tone) ? tone : "Friendly";
	const prompt = buildPrompt({ commentText: cleanedComment, viewerName, tone: normalizedTone, videoTitle });

	try {
		const model = getGeminiModel();
		const result = await model.generateContent({
			contents: [
				{
					role: "user",
					parts: [{ text: prompt }],
				},
			],
		});
		const text = result?.response?.text()?.trim();
		if (!text) {
			throw new Error("Gemini returned an empty reply");
		}
		return text;
	} catch (err) {
		const message = err?.message || "Failed to generate reply";
		throw new Error(message);
	}
};

export { generateCommentReply };

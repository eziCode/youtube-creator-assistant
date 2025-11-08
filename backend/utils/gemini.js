import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedModel = null;
let cachedKey = null;
let cachedModelName = null;

const getGeminiModel = () => {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("GEMINI_API_KEY must be configured to generate replies");
	}

	const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

	if (cachedModel && cachedKey === apiKey && cachedModelName === modelName) {
		return cachedModel;
	}

	const client = new GoogleGenerativeAI(apiKey);
	cachedModel = client.getGenerativeModel({
		model: modelName,
		generationConfig: {
			temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.6),
			topP: Number(process.env.GEMINI_TOP_P ?? 0.9),
		},
	});
	cachedKey = apiKey;
	cachedModelName = modelName;

	return cachedModel;
};

export { getGeminiModel };

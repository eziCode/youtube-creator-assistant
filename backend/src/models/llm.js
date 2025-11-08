import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateVideoContent(channelVideos, trendingVideos) {
  const pastTitles = channelVideos.map(v => v.title).join(", ");
  const trendingTitles = trendingVideos.map(v => v.title).join(", ");

  const prompt = `
You are an AI content assistant for a YouTube creator.
Past video titles: ${pastTitles}
Trending video titles: ${trendingTitles}

Generate:
1. A catchy video title
2. A 5-paragraph video script
3. A prompt for AI thumbnail generation (start with "Thumbnail prompt:")
`;

  const response = await client.chat.completions.create({
    model: "gemini-1.5",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8
  });

  println("LLM response received");

  return response.choices[0].message?.content || "";
}

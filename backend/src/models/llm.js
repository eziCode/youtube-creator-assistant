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

Task: Analyze the provided past video titles (and trending titles) and infer the channel's primary focus and recurring themes. Produce a detail description called "channel_focus" (2-3 paragraph) describing the channel's typical topics, presentation style, and audience. Use any signals available in the titles (keywords, repeated terms, topic areas) to infer the focus — do not assume a niche unless supported by the titles.

Second, propose multiple video ideas that are firmly grounded in the inferred channel focus. Use the past video titles to preserve the channel voice and use trending titles only as inspiration to find angles that make sense for the inferred focus.

Requirements for each idea:
- title: a short, clear YouTube-style title (<= 80 chars) that accurately describes a project or presentation and would appeal to the channel's audience.
- script: a 9-paragraph script suitable for a presentation video (intro, hypothesis, methods, results, takeaway). Keep the tone factual and educational; avoid inventing sensational claims.
- thumbnail_prompt: a concise prompt for AI image generation that describes visual elements and composition. Start this field with the words "Thumbnail prompt:".

Constraints:
- Stay realistic and grounded in the type of content suggested by the past titles. Avoid off-topic or sensational themes unless the input titles clearly indicate such themes.
- Favor topics that could plausibly be executed as student research projects, demonstrations, or explainers if the channel content suggests that.

Output format:
Return a single valid JSON object (no extra commentary). The object must contain two keys:
1) "channel_focus": string (7-8 sentences)
2) "videos": an array of objects (see Requirements above). Example shape:
{
  "channel_focus": "...",
  "videos": [ { "title": "...", "script": "...", "thumbnail_prompt": "Thumbnail prompt: ..." }, ... ]
}
`;
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-3.5-turbo";

  try {
    console.log(`[llm] calling model ${model}`);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    console.log("LLM response received");

    return response.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("[llm] LLM call failed:", err?.message || err);
    // Re-throw so upstream can handle and return a useful error
    throw err;
  }
}

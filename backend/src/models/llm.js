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

Task: Analyze the provided past video titles (and trending titles) and infer the channel's primary focus and recurring themes. Produce a short description called "channel_focus" (1-2 sentences) describing the channel's typical topics, presentation style, and audience. Use any signals available in the titles (keywords, repeated terms, topic areas) to infer the focus — do not assume a niche unless supported by the titles.

Second, propose multiple video ideas that are firmly grounded in the inferred channel focus. Use the past video titles to preserve the channel voice and use trending titles only as inspiration to find angles that make sense for the inferred focus.

Requirements for each idea:
- title: a short, clear YouTube-style title (<= 80 chars) that accurately describes a project or presentation and would appeal to the channel's audience.
- script: a 5-paragraph script suitable for a presentation video (intro, hypothesis, methods, results, takeaway). Keep the tone factual and educational; avoid inventing sensational claims.
- thumbnail_prompt: a concise prompt for AI image generation that describes visual elements and composition. Start this field with the words "Thumbnail prompt:".

Constraints:
- Stay realistic and grounded in the type of content suggested by the past titles. Avoid off-topic or sensational themes unless the input titles clearly indicate such themes.
- Favor topics that could plausibly be executed as student research projects, demonstrations, or explainers if the channel content suggests that.

Output format:
Return a single valid JSON object (no extra commentary). The object must contain two keys:
1) "channel_focus": string (1-2 sentences)
2) "videos": an array of objects (see Requirements above). Example shape:
{
  "channel_focus": "...",
  "videos": [ { "title": "...", "script": "...", "thumbnail_prompt": "Thumbnail prompt: ..." }, ... ]
}
`;
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-3.5-turbo";

  // Request multiple structured video ideas in JSON so backend can create multiple thumbnails
  const ideasCount = process.env.LLM_VIDEO_IDEAS_COUNT ? Number(process.env.LLM_VIDEO_IDEAS_COUNT) : 5;

  const jsonPrompt = `${prompt}\n\nPlease output a JSON array named \"videos\" with ${ideasCount} items. Each item should be an object with the keys:\n- title: string (short title)\n- script: string (the full 5-paragraph script)\n- thumbnail_prompt: string (a short prompt used to generate a thumbnail)\nEnsure the output is valid JSON only (no extra commentary).`;

  try {
    console.log(`[llm] calling model ${model} for ${ideasCount} video ideas`);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: jsonPrompt }],
      temperature: 0.8,
    });

    console.log("LLM response received");
    const content = response.choices?.[0]?.message?.content || "";

    // Try to extract JSON from the model output
    let jsonText = content.trim();
    // If the model wrapped JSON in backticks or in markdown, strip that
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) jsonText = codeBlockMatch[1].trim();

    // Try to parse JSON object with channel_focus + videos
    let parsedObj = null;
    try {
      const firstCurly = jsonText.indexOf("{");
      if (firstCurly !== -1) {
        const objText = jsonText.slice(firstCurly);
        const obj = JSON.parse(objText);
        parsedObj = obj;
      }
    } catch (err) {
      console.warn('[llm] Failed to parse JSON object from LLM output, falling back to array/object heuristics', err?.message || err);
    }

    // If we parsed an object with videos, normalize it
    if (parsedObj && Array.isArray(parsedObj.videos)) {
      const normalized = parsedObj.videos.map((it, idx) => ({
        id: it.id || `generated-${idx + 1}`,
        title: it.title || it.name || `Generated Video ${idx + 1}`,
        script: it.script || it.description || "",
        thumbnail_prompt: it.thumbnail_prompt || it.thumbnailPrompt || "Creative YouTube thumbnail",
      }));

      return { channel_focus: parsedObj.channel_focus || "", videos: normalized };
    }

    // If not an object, try to find the first JSON array and treat it as videos
    const firstBracket = jsonText.indexOf("[");
    const firstCurly = jsonText.indexOf("{");
    let parsed = null;
    try {
      if (firstBracket !== -1 && (firstBracket < firstCurly || firstCurly === -1)) {
        const arrText = jsonText.slice(firstBracket);
        parsed = JSON.parse(arrText);
      }
    } catch (err) {
      console.warn('[llm] Failed to parse JSON array from LLM output, falling back to raw text', err?.message || err);
    }

    if (!parsed) {
      // As a last resort, return the raw text so upstream can decide
      return content;
    }

    // Normalize items: ensure keys exist
    const normalized = parsed.map((it, idx) => ({
      id: it.id || `generated-${idx + 1}`,
      title: it.title || it.name || `Generated Video ${idx + 1}`,
      script: it.script || it.description || "",
      thumbnail_prompt: it.thumbnail_prompt || it.thumbnailPrompt || "Creative YouTube thumbnail",
    }));

    return { channel_focus: "", videos: normalized };
  } catch (err) {
    console.error("[llm] LLM call failed:", err?.message || err);
    throw err;
  }
}

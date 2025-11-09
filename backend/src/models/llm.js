import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const formatCount = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "N/A";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num}`;
};

const formatDate = (iso) => {
  if (!iso) return "unknown date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown date";
  return date.toISOString().slice(0, 10);
};

export async function generateVideoContent(channelVideos = []) {
  const safeVideos = Array.isArray(channelVideos) ? channelVideos : [];

  const sortedByViews = [...safeVideos]
    .filter((video) => Number.isFinite(Number(video?.viewCount)))
    .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0));

  const topPerformers = sortedByViews.slice(0, 5);

  const recentUploads = [...safeVideos]
    .filter((video) => Boolean(video?.publishedAt))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);

  const topList =
    topPerformers.length > 0
      ? topPerformers
          .map(
            (video) =>
              `- ${video.title} • ${formatCount(video.viewCount)} views • published ${formatDate(video.publishedAt)}`
          )
          .join("\n")
      : "- No view data available.";

  const recentList =
    recentUploads.length > 0
      ? recentUploads
          .map(
            (video) =>
              `- ${video.title} • ${formatCount(video.viewCount)} views • published ${formatDate(video.publishedAt)}`
          )
          .join("\n")
      : "- No recent uploads provided.";

  const prompt = `
You are an AI strategist for a YouTube creator. Use the historical performance data to understand what resonates.

High-performing videos (ranked by views):
${topList}

Recent uploads:
${recentList}

Task:
1. Infer the channel's focus, audience, tone, and proven hooks using the high-performing titles and metrics.
2. Recommend new long-form video ideas (the "videos" array) that build on the successes above. Each idea must clearly reference why it would work: tie the concept back to the past hits, escalate difficulty, or fill a gap the data suggests.
3. Keep suggestions realistic for the channel's production style. Reflect on why past hits worked (e.g., hands-on builds, science experiments, storytelling) and evolve them—do not repeat titles outright.
4. Provide specific talking points in the script intro that reference the prior performance insights (e.g., "After our solar purifier video hit 45K views...").

Requirements for each idea entry:
- title: <= 80 characters, compelling yet accurate.
- script: 5 paragraphs (intro, problem/opportunity, approach, results/expectations, call-to-action/next experiment). The intro must link to past performance signals; the remainder should stay practical and data-aware.
- thumbnail_prompt: start with "Thumbnail prompt:" and describe a dynamic composition, referencing props or scenes aligned with the concept.

Respond with valid JSON only.`;

  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-3.5-turbo";
  const envIdeas = Number(process.env.LLM_VIDEO_IDEAS_COUNT);
  const ideasCount = Number.isFinite(envIdeas) && envIdeas > 0 ? Math.min(envIdeas, 3) : 3;

  const jsonPrompt = `${prompt}\n\nOutput schema:\n{\n  "channel_focus": "1-2 sentence summary referencing proven themes and audience",\n  "videos": [\n    {\n      "title": "...",\n      "script": "...",\n      "thumbnail_prompt": "Thumbnail prompt: ..."\n    }\n  ]\n}\nEnsure "videos" contains exactly ${ideasCount} items. Do not include extra commentary.`;

  try {
    console.log(`[llm] calling model ${model} for ${ideasCount} video ideas`);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: jsonPrompt }],
      temperature: 0.7,
    });

    console.log("LLM response received");
    const content = response.choices?.[0]?.message?.content || "";

    let jsonText = content.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) jsonText = codeBlockMatch[1].trim();

    let parsedObj = null;
    try {
      const firstCurly = jsonText.indexOf("{");
      if (firstCurly !== -1) {
        const objText = jsonText.slice(firstCurly);
        parsedObj = JSON.parse(objText);
      }
    } catch (err) {
      console.warn("[llm] Failed to parse JSON object from LLM output, falling back to array/object heuristics", err?.message || err);
    }

    if (parsedObj && Array.isArray(parsedObj.videos)) {
      const normalized = parsedObj.videos.map((it, idx) => ({
        id: it.id || `generated-${idx + 1}`,
        title: it.title || it.name || `Generated Video ${idx + 1}`,
        script: it.script || it.description || "",
        thumbnail_prompt: it.thumbnail_prompt || it.thumbnailPrompt || "Creative YouTube thumbnail",
      }));

      return { channel_focus: parsedObj.channel_focus || "", videos: normalized.slice(0, ideasCount) };
    }

    const firstBracket = jsonText.indexOf("[");
    const firstCurly = jsonText.indexOf("{");
    let parsed = null;
    try {
      if (firstBracket !== -1 && (firstBracket < firstCurly || firstCurly === -1)) {
        const arrText = jsonText.slice(firstBracket);
        parsed = JSON.parse(arrText);
      }
    } catch (err) {
      console.warn("[llm] Failed to parse JSON array from LLM output, falling back to raw text", err?.message || err);
    }

    if (!parsed) {
      return content;
    }

    const normalized = parsed.slice(0, ideasCount).map((it, idx) => ({
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

import React, { useState } from "react";
import { API_BASE_URL } from "../constants";

interface VideoIdeasGeneratorTabProps {
  userChannelId: string | null;
  useSample?: boolean;
}

interface GeneratedVideo {
  id: string;
  title: string;
  script: string;
  thumbnailPrompt: string;
  thumbnailPath: string;
}

const VideoIdeasGeneratorTab: React.FC<VideoIdeasGeneratorTabProps> = ({ userChannelId, useSample = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortsIdeas, setShortsIdeas] = useState<GeneratedVideo[]>([]);
  const [videoIdeas, setVideoIdeas] = useState<GeneratedVideo[]>([]);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!userChannelId) {
      setError("No YouTube channel connected.");
      return;
    }
    console.log("Generated video ideas for channel ID:", userChannelId);

    setIsLoading(true);
    setError(null);
    setShortsIdeas([]);
    setVideoIdeas([]);
    setExpandedVideoId(null);

    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // send cookies (session) to backend
        body: JSON.stringify({ channelId: userChannelId, useSample }),
      });

      const data = await response.json();
      console.log("Backend response:", response, data);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to generate video ideas.");
      }

      // Handle newer backend response that may return a single llm_output + thumbnail_path
      if (data && (data.videos || data.shorts)) {
        setShortsIdeas(data.shorts || []);
        setVideoIdeas(data.videos || []);
      } else if (data && (data.llm_output || data.thumbnail_path)) {
        // Try to extract a title from the LLM output
        const llm = data.llm_output || "";
        const titleMatch = llm.match(/1\.?\s*Catchy video title:\s*\"?([^\"\n]+)\"?/i);
        const title = titleMatch ? titleMatch[1].trim() : "Generated Video";

        const generated: GeneratedVideo = {
          id: "generated-1",
          title,
          script: llm,
          thumbnailPrompt: data.thumbnail_prompt || "",
          thumbnailPath: data.thumbnail_path || "",
        };

        setShortsIdeas([]);
        setVideoIdeas([generated]);
        setExpandedVideoId(generated.id);
      } else {
        setShortsIdeas([]);
        setVideoIdeas([]);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderVideoCard = (video: GeneratedVideo) => {
    const isExpanded = expandedVideoId === video.id;

    return (
      <div
        key={video.id}
        className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(15,23,42,0.45)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
      >
        <div
          className="flex cursor-pointer items-center transition-colors hover:bg-white/10"
          onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
        >
          {video.thumbnailPath && (
            <img
              src={video.thumbnailPath}
              alt={video.title}
              className="h-24 w-24 rounded-l-2xl object-cover"
            />
          )}
          <div className="p-2 flex-1">
            <h4 className="text-sm font-semibold text-white">{video.title}</h4>
          </div>
        </div>
        {isExpanded && (
          <div className="whitespace-pre-line bg-white/5 p-4 text-xs text-white/70">
            {video.script || "No script available."}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex max-h-[calc(100vh-150px)] flex-col gap-8 overflow-y-auto text-white">
      <h2 className="text-3xl font-semibold text-white drop-shadow-sm">Video Ideas Generator</h2>

      <button
        onClick={handleGenerate}
        disabled={isLoading || !userChannelId}
        className="w-fit rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(99,102,241,0.45)] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50 disabled:shadow-none"
      >
        {isLoading ? "Generating..." : "Generate Video & Shorts Ideas"}
      </button>

      {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-inner shadow-rose-500/10">{error}</p>}

      {/* Shorts Ideas Section */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Shorts Ideas</h3>
        {shortsIdeas.length === 0 && !isLoading && <p className="text-sm text-white/60">No shorts ideas generated yet.</p>}
        <div className="flex flex-col">
          {shortsIdeas.map(renderVideoCard)}
        </div>
      </section>

      {/* Video Ideas Section */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Video Ideas</h3>
        {videoIdeas.length === 0 && !isLoading && <p className="text-sm text-white/60">No video ideas generated yet.</p>}
        <div className="flex flex-col">
          {videoIdeas.map(renderVideoCard)}
        </div>
      </section>
    </div>
  );
};

export default VideoIdeasGeneratorTab;

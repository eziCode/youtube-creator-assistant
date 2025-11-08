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
      if (data && data.videos) {
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


        setVideoIdeas([generated]);
        setExpandedVideoId(generated.id);
      } else {
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
      <div key={video.id} className="border rounded-lg overflow-hidden shadow-sm mb-4">
        <div
          className="flex items-center cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
        >
          {video.thumbnailPath && (
            <img
              src={video.thumbnailPath}
              alt={video.title}
              className="w-24 h-24 object-cover rounded-l-lg"
            />
          )}
          <div className="p-2 flex-1">
            <h4 className="font-semibold text-sm">{video.title}</h4>
          </div>
        </div>
        {isExpanded && (
          <div className="p-2 bg-gray-50 text-xs whitespace-pre-line">
            {video.script || "No script available."}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 overflow-y-auto max-h-[calc(100vh-150px)]">
      <h2 className="text-xl font-bold">Video Ideas Generator</h2>

      <button
        onClick={handleGenerate}
        disabled={isLoading || !userChannelId}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {isLoading ? "Generating..." : "Generate Video Ideas"}
      </button>

      {error && <p className="text-red-500">{error}</p>}

      {/* Video Ideas Section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Video Ideas</h3>
        {videoIdeas.length === 0 && !isLoading && <p className="text-sm text-gray-500">No video ideas generated yet.</p>}
        <div className="flex flex-col">
          {videoIdeas.map(renderVideoCard)}
        </div>
      </section>
    </div>
  );
};

export default VideoIdeasGeneratorTab;

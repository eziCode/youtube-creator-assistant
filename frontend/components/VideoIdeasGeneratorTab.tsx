import React, { useState, useRef } from "react";
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
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerate = async () => {
    if (!userChannelId) {
      setError("No YouTube channel connected.");
      return;
    }
    // If user hasn't selected an image, ask whether they want to upload one now.
    if (!uploadedImageDataUrl) {
      const want = window.confirm("Do you want to upload an image to include in the thumbnails? Click OK to select a file now, or Cancel to continue without an image.");
      if (want) {
        fileInputRef.current?.click();
        return; // user will click Generate again after selecting
      }
    }
    console.log("Generated video ideas for channel ID:", userChannelId);

    setIsLoading(true);
    setError(null);
    setShortsIdeas([]);
    setVideoIdeas([]);
    setExpandedVideoId(null);

    try {
      const payload: any = { channelId: userChannelId, useSample };

      // If user selected a file, upload it first via multipart/form-data
      if (uploadedImageFile) {
        const form = new FormData();
        form.append('image', uploadedImageFile);

        const upResp = await fetch(`${API_BASE_URL}/upload-image`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });

        if (!upResp.ok) {
          const err = await upResp.json().catch(() => ({}));
          throw new Error(err?.error || 'Image upload failed');
        }

        const upData = await upResp.json();
        payload.uploadedImagePath = upData.uploadedImagePath;
      }

      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // send cookies (session) to backend
        body: JSON.stringify(payload),
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setUploadedImageDataUrl(result);
      };
      reader.readAsDataURL(file);
  };

  const renderVideoCard = (video: GeneratedVideo) => {
    const isExpanded = expandedVideoId === video.id;

    return (
      <div key={video.id} className="border rounded-lg overflow-hidden shadow-sm mb-4">
        <button
          className="w-full text-left cursor-pointer"
          onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
        >
          {video.thumbnailPath && (
            <img
              src={video.thumbnailPath}
              alt={video.title}
              className="w-full h-48 object-cover bg-gray-200"
            />
          )}
          <div className="p-3">
            <h4 className="font-semibold text-base line-clamp-2">{video.title}</h4>
          </div>
        </button>
        {isExpanded && (
          <div className="p-3 bg-gray-50 text-sm whitespace-pre-line">
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
        {isLoading ? "Generating..." : "Generate Video & Shorts Ideas"}
      </button>

      {error && <p className="text-red-500">{error}</p>}

  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />

      {/* Shorts Ideas Section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Shorts Ideas</h3>
        {shortsIdeas.length === 0 && !isLoading && <p className="text-sm text-gray-500">No shorts ideas generated yet.</p>}
        <div className="flex flex-col">
          {shortsIdeas.map(renderVideoCard)}
        </div>
      </section>

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

import React, { useState, useRef, useEffect } from "react";
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
  thumbnailPath: string | null;
  thumbnailId?: string;
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

  // Separate component for video card to use hooks
  const VideoCard: React.FC<{ video: GeneratedVideo; isExpanded: boolean; onToggle: () => void }> = ({ video, isExpanded, onToggle }) => {
    const [thumbnailReady, setThumbnailReady] = useState(false);
    const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(video.thumbnailPath);

    // Poll for thumbnail if we have a thumbnailId
    useEffect(() => {
      if (video.thumbnailId && !thumbnailReady) {
        const pollThumbnail = async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/generate/thumbnail/${video.thumbnailId}`, {
              credentials: 'include',
            });
            const data = await response.json();
            if (data.ready && data.dataUri) {
              setThumbnailSrc(data.dataUri);
              setThumbnailReady(true);
            } else if (!data.ready) {
              // Poll again after 1 second
              setTimeout(pollThumbnail, 1000);
            }
          } catch (err) {
            console.error('Error polling thumbnail:', err);
            // Retry after 2 seconds on error
            setTimeout(pollThumbnail, 2000);
          }
        };
        pollThumbnail();
      }
    }, [video.thumbnailId, thumbnailReady]);

    return (
      <div className="border rounded-lg overflow-hidden shadow-sm mb-4">
        <button
          className="w-full text-left cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          type="button"
        >
          <div className="w-full flex justify-center bg-gray-100 py-2">
            <div className="w-4/5 bg-gray-200 flex items-center justify-center relative" style={{ minHeight: '192px' }}>
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={video.title}
                  className="w-full h-auto"
                />
              ) : (
                <div className="flex flex-col items-center justify-center w-full" style={{ minHeight: '192px' }}>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-2"></div>
                  <p className="text-gray-500 text-sm">Generating thumbnail...</p>
                </div>
              )}
            </div>
          </div>
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

  const renderVideoCard = (video: GeneratedVideo) => {
    const isExpanded = expandedVideoId === video.id;
    return (
      <VideoCard
        key={video.id}
        video={video}
        isExpanded={isExpanded}
        onToggle={() => setExpandedVideoId(isExpanded ? null : video.id)}
      />
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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Upload Person Image (Optional)
        </label>
        <p className="text-xs text-gray-500">
          Please upload a transparent background PNG image of the person to include in thumbnails.
        </p>
        <div className="relative">
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/png" 
            onChange={handleImageChange} 
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Choose File
          </button>
          {uploadedImageFile && (
            <span className="ml-3 text-sm text-gray-600">
              {uploadedImageFile.name}
            </span>
          )}
        </div>
        {uploadedImageDataUrl && (
          <div className="mt-2">
            <p className="text-xs text-green-600 mb-1">✓ Image uploaded</p>
            <img 
              src={uploadedImageDataUrl} 
              alt="Uploaded" 
              className="max-w-xs max-h-32 border rounded"
            />
          </div>
        )}
      </div>

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

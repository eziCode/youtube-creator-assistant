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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type SampleIdeaBlueprint = Omit<GeneratedVideo, "id">;

const SAMPLE_IDEA_BLUEPRINTS: SampleIdeaBlueprint[] = [
  {
    title: "I tried an AI camera rig for a week",
    script: [
      "Hook: drop the rig on the desk with that satisfying thunk.",
      "Segment 1: quick montage of the auto-tracking nailing focus shifts.",
      "Segment 2: live vlog test walking through a crowded hallway.",
      "Segment 3: split-screen versus your classic gimbal setup.",
      "Wrap: ask which rig they'd trust on a client shoot.",
    ].join("\n"),
    thumbnailPrompt:
      "Creator holding a futuristic camera rig under neon magenta lights, high-contrast tech aesthetic, crisp typography that reads 'AI RIG TEST'.",
    thumbnailPath: null,
  },
  {
    title: "Vision Pro vs Quest: creator workflow showdown",
    script: [
      "Hook: stack both headsets and ask which one edits faster.",
      "Segment 1: capture B-roll of timeline scrubbing inside each headset.",
      "Segment 2: test color grading with hand controls versus controllers.",
      "Segment 3: show export speed and battery drain overlays.",
      "CTA: invite comments on which headset should get a studio tour next.",
    ].join("\n"),
    thumbnailPrompt:
      "Split-screen thumbnail with Vision Pro and Quest headsets, bold lightning bolt divider, vibrant cyberpunk studio backdrop.",
    thumbnailPath: null,
  },
  {
    title: "Desk makeover 2025: build the dream creator workspace",
    script: [
      "Hook: reveal the chaotic 'before' shot with dramatic zoom.",
      "Segment 1: timelapse of swapping in the ambient lighting and motorized desk.",
      "Segment 2: cable management hacks with labeled drawers and magnetic ties.",
      "Segment 3: show the final desk POV while editing a video.",
      "CTA: offer a downloadable gear list in the description.",
    ].join("\n"),
    thumbnailPrompt:
      "Ultra-wide desk shot with RGB lighting, dual monitors, overhead light bars, clean minimalist tech aesthetic, centered hero product.",
    thumbnailPath: null,
  },
  {
    title: "Top 5 creator-friendly Android phones right now",
    script: [
      "Hook: stack all five phones and call out the surprise winner.",
      "Segment 1: test ultrawide camera stabilization on a downtown walk.",
      "Segment 2: compare export times from a 4K vlog clip under a timer.",
      "Segment 3: battery rundown chart with dramatic energy icons.",
      "Wrap: crown the winner and tease a camera deep dive next week.",
    ].join("\n"),
    thumbnailPrompt:
      "Fan-out of five modern Android phones on a reflective surface, neon accent lighting, bold text 'CREATOR PHONE RANKED'.",
    thumbnailPath: null,
  },
];

const buildSampleIdeas = (): GeneratedVideo[] =>
  SAMPLE_IDEA_BLUEPRINTS.map((idea, index) => ({
    ...idea,
    id: `sample-idea-${index}-${Math.random().toString(36).slice(2, 7)}`,
  })).sort(() => Math.random() - 0.5);

const VideoIdeasGeneratorTab: React.FC<VideoIdeasGeneratorTabProps> = ({ userChannelId, useSample = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoIdeas, setVideoIdeas] = useState<GeneratedVideo[]>([]);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneStateClasses = isDragActive
    ? "border-indigo-300/70 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.45)]"
    : "border-white/10 bg-slate-900/50";

  const handleGenerate = async () => {
    if (!useSample && !userChannelId) {
      setError("No YouTube channel connected.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoIdeas([]);

    try {
      if (useSample) {
        await delay(320);
        const sampleIdeas = buildSampleIdeas();
        setVideoIdeas(sampleIdeas);
        return;
      }

      console.log("Generated video ideas for channel ID:", userChannelId);

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

      if (data && (data.videos || data.shorts)) {
        setVideoIdeas(data.videos || []);
      } else if (data && (data.llm_output || data.thumbnail_path)) {
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

  const processSelectedFile = (file: File | null) => {
    if (!file) return;
    setUploadedImageFile(file);
    setUploadedImageDataUrl(null);
    setUploadedImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedImageDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    processSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processSelectedFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  };

  // Separate component for video card to use hooks
  const VideoCard: React.FC<{ video: GeneratedVideo }> = ({ video }) => {
    const [thumbnailReady, setThumbnailReady] = useState(false);
    const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(video.thumbnailPath);
    const [showFullScript, setShowFullScript] = useState(false);

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

    const scriptText = video.script || "";
    const previewLines = scriptText.split("\n");
    const previewText = showFullScript ? scriptText : previewLines.slice(0, 4).join("\n");
    const shouldShowToggle = previewLines.length > 4;

    return (
      <article className="rounded-2xl border border-white/10 bg-slate-900/80 shadow-lg transition hover:border-indigo-400/30 hover:shadow-[0_20px_60px_rgba(79,70,229,0.25)]">
        <div className="flex flex-col gap-5 p-4 md:flex-row md:items-center">
          <div className="flex w-full justify-center md:w-auto">
            <div className="relative max-w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
              <div className="flex items-center justify-center p-3">
                {thumbnailSrc ? (
                  <img
                    src={thumbnailSrc}
                    alt={video.title}
                    className="max-h-40 w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="flex h-36 w-56 flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="h-11 w-11 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Generating thumbnail…</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <header className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-indigo-200/80">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-200">
                  Video Idea
                </span>
              </div>
              <h4 className="text-lg font-semibold text-white">{video.title}</h4>
            </header>

            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-sm text-slate-100 shadow-inner shadow-slate-950/40 whitespace-pre-line">
              {previewText || "No script available."}
            </div>
            {shouldShowToggle && (
              <button
                className="self-start text-xs font-medium text-indigo-200 underline-offset-4 transition hover:text-indigo-100 hover:underline"
                onClick={(event) => {
                  event.preventDefault();
                  setShowFullScript((prev) => !prev);
                }}
                type="button"
              >
                {showFullScript ? "Show less" : "View more"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderVideoCard = (video: GeneratedVideo) => <VideoCard key={video.id} video={video} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden text-white">
      <section className="flex flex-col flex-shrink-0 rounded-3xl border border-white/5 bg-slate-950/60 backdrop-blur-md shadow-[0_24px_80px_rgba(15,23,42,0.55)]">
        <div className="flex flex-1 flex-col gap-6 p-6">
            <header className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-wide text-indigo-200/80">Ideation Toolkit</p>
              <h2 className="text-3xl font-semibold text-white">Video Ideas Generator</h2>
              <p className="text-sm text-slate-300">
                Generate new video angles inspired by your channel&apos;s best performers. Upload an optional face or product photo to influence thumbnails.
              </p>
            </header>

            <button
              onClick={handleGenerate}
              disabled={isLoading || !userChannelId}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_24px_45px_rgba(99,102,241,0.35)] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
              type="button"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                  Generating ideas…
                </>
              ) : (
                <>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-base leading-none">✨</span>
                  Generate video & shorts ideas
                </>
              )}
            </button>

            {error && (
              <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200 shadow-inner shadow-rose-500/15">
                {error}
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
                  📁
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Optional person / product image</p>
                  <p className="text-xs text-slate-400">Use PNGs with transparent backgrounds for the best results.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 shadow-inner shadow-slate-950/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div
                  className={`group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${dropZoneStateClasses}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragActive(false);
                  }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                    🖼️
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      Drag & drop an image here
                    </p>
                    <p className="text-xs text-slate-300">
                      PNG, JPG, JPEG, or WebP up to 5MB. We&apos;ll remove the background automatically.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-medium text-white transition group-hover:bg-white/20">
                    Browse files
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Selected file</span>
                    {uploadedImageFile ? (
                      <span className="truncate text-xs text-indigo-200">{uploadedImageFile.name}</span>
                    ) : (
                      <span className="text-xs text-slate-500">None</span>
                    )}
                  </div>
                  {uploadedImageDataUrl && (
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-black/40">
                      <img
                        src={uploadedImageDataUrl}
                        alt="Uploaded preview"
                        className="h-32 w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>
      </section>

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-950/60">
          <header className="border-b border-white/5 bg-white/5 px-6 py-4">
            <h3 className="text-lg font-semibold text-white">Generated ideas</h3>
            <p className="text-xs text-slate-300">
              Thumbnails and scripts appear here once generated.
            </p>
          </header>

          {/* Fixed scrollable region */}
          <div
            className="
              flex-1 
              overflow-y-auto 
              px-6 py-5 pr-3
              [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
              max-h-[calc(100vh-300px)]
            "
          >
            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold text-white/90">Video ideas</h4>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                    {videoIdeas.length} ready
                  </span>
                </div>

                {videoIdeas.length === 0 && !isLoading ? (
                  <p className="text-sm text-white/50">
                    No video ideas yet — click generate to get started.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">{videoIdeas.map(renderVideoCard)}</div>
                )}
              </section>
            </div>
          </div>
        </section>
    </div>
  );
};

export default VideoIdeasGeneratorTab;

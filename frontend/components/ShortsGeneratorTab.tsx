import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShortClip,
  ShortDownloadStatus,
  ShortPublicationResult,
  Video,
} from "../types";
import {
  fetchShortIdeas,
  publishShortClip,
  initiateShortDownload,
  cancelShortDownload,
  fetchDownloadStatus,
  fetchShortPublicationStatus,
} from "../services/shortsService";
import Card from "./Card";

interface ShortsGeneratorTabProps {
  selectedVideo: Video | null;
  isDemoMode?: boolean;
}

const DOWNLOAD_STATUS_LABELS: Record<ShortDownloadStatus, string> = {
  pending: "Preparing download…",
  downloading: "Downloading video…",
  completed: "Download ready",
  cancelled: "Download cancelled",
  failed: "Download failed",
};

const getDownloadStatusLabel = (status: ShortDownloadStatus | null) => {
  if (!status) return null;
  return DOWNLOAD_STATUS_LABELS[status] ?? status;
};

const formatSeconds = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const ShortsGeneratorTab: React.FC<ShortsGeneratorTabProps> = ({ selectedVideo, isDemoMode = false }) => {
  const [shorts, setShorts] = useState<ShortClip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  const [publishResults, setPublishResults] = useState<Record<number, ShortPublicationResult>>({});
  const [notification, setNotification] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<ShortDownloadStatus | null>(null);

  const downloadRequestSeqRef = useRef(0);
  const currentDownloadIdRef = useRef<string | null>(null);
  const currentDownloadVideoIdRef = useRef<string | null>(null);
  const jobPollsRef = useRef<Record<string, { cancelled: boolean; timeoutId?: number; clipIndex: number }>>({});

  const stopJobPolling = useCallback((jobId?: string) => {
    if (jobId) {
      const poll = jobPollsRef.current[jobId];
      if (poll) {
        poll.cancelled = true;
        if (poll.timeoutId) {
          window.clearTimeout(poll.timeoutId);
        }
        delete jobPollsRef.current[jobId];
      }
      return;
    }
    Object.keys(jobPollsRef.current).forEach((id) => stopJobPolling(id));
  }, []);

  const scheduleJobPoll = useCallback(
    (jobId: string, clipIndex: number, attempt = 0) => {
    const poll = jobPollsRef.current[jobId];
    if (!poll || poll.cancelled) {
      return;
    }

    const targetClipIndex = poll.clipIndex ?? clipIndex;
    const delay = Math.min(4000, 1000 + attempt * 500);
    poll.timeoutId = window.setTimeout(async () => {
      if (poll.cancelled) {
        return;
      }

      try {
        const publication = await fetchShortPublicationStatus(jobId);
        setPublishResults((prev) => ({
          ...prev,
          [targetClipIndex]: publication,
        }));

        if (publication.message) {
          setNotification(publication.message);
        }

        if (publication.status === "completed" || publication.status === "failed") {
          stopJobPolling(jobId);
          return;
        }

        scheduleJobPoll(jobId, targetClipIndex, attempt + 1);
      } catch (error) {
        console.error("[shorts] failed to fetch job status", error);
        if (attempt < 5) {
          scheduleJobPoll(jobId, targetClipIndex, attempt + 1);
        } else {
          setNotification(
            error instanceof Error ? error.message : "Unable to refresh short status. Please try again later."
          );
          stopJobPolling(jobId);
        }
      }
    }, delay);
    },
    [stopJobPolling]
  );

  const startJobPolling = useCallback(
    (jobId: string, clipIndex: number) => {
    if (!jobId) return;
    stopJobPolling(jobId);
    jobPollsRef.current[jobId] = { cancelled: false, clipIndex };
    scheduleJobPoll(jobId, clipIndex);
    },
    [scheduleJobPoll, stopJobPolling]
  );

  useEffect(() => {
    setShorts([]);
    setNotification(null);
    setPublishResults({});
    setPublishingIndex(null);
    setDownloadStatus(null);
    setDownloadId(null);
    stopJobPolling();
  }, [selectedVideo?.id, stopJobPolling]);

  useEffect(() => {
    const runDownloadLifecycle = async () => {
      downloadRequestSeqRef.current += 1;
      const requestId = downloadRequestSeqRef.current;

      const previousId = currentDownloadIdRef.current;
      if (previousId) {
        const previousVideoId = currentDownloadVideoIdRef.current;
        if (selectedVideo && previousVideoId === selectedVideo.id) {
          try {
            const existing = await fetchDownloadStatus(previousId);
            if (downloadRequestSeqRef.current !== requestId) {
              return;
            }
            if (!["failed", "cancelled"].includes(existing.status)) {
              currentDownloadIdRef.current = existing.id;
              currentDownloadVideoIdRef.current = selectedVideo.id;
              setDownloadId(existing.id);
              setDownloadStatus(existing.status);
              return;
            }
          } catch (error) {
            console.warn("[shorts] failed to refresh existing download", error);
          }
        }
        try {
          await cancelShortDownload(previousId, true);
        } catch (error) {
          console.warn("[shorts] failed to cancel previous download", error);
        }
        if (downloadRequestSeqRef.current !== requestId) {
          return;
        }
        currentDownloadIdRef.current = null;
        currentDownloadVideoIdRef.current = null;
        setDownloadId(null);
        setDownloadStatus(null);
      }

      if (!selectedVideo) {
        return;
      }

      try {
        const download = await initiateShortDownload(selectedVideo.id);
        if (downloadRequestSeqRef.current !== requestId) {
          const isCurrentDownload =
            currentDownloadIdRef.current !== null && currentDownloadIdRef.current === download.id;
          if (!isCurrentDownload) {
            await cancelShortDownload(download.id, true).catch(() => undefined);
          }
          return;
        }
        currentDownloadIdRef.current = download.id;
        currentDownloadVideoIdRef.current = selectedVideo.id;
        setDownloadId(download.id);
        setDownloadStatus(download.status);
      } catch (error) {
        console.error("[shorts] failed to initiate download", error);
        if (error instanceof Error) {
          setNotification(error.message);
        } else {
          setNotification("Failed to start video download. Please retry.");
        }
        setDownloadId(null);
        setDownloadStatus(null);
      }
    };

    runDownloadLifecycle();

    return () => {
      downloadRequestSeqRef.current += 1;
    };
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (!downloadId) {
      return;
    }
    if (downloadStatus && ["completed", "failed", "cancelled"].includes(downloadStatus)) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const download = await fetchDownloadStatus(downloadId);
        setDownloadStatus(download.status);
        if (["completed", "failed", "cancelled"].includes(download.status)) {
          window.clearInterval(interval);
        }
      } catch (error) {
        console.error("[shorts] failed to poll download status", error);
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [downloadId, downloadStatus]);

  useEffect(() => {
    return () => {
      stopJobPolling();
      const currentId = currentDownloadIdRef.current;
      if (currentId) {
        cancelShortDownload(currentId, true).catch(() => undefined);
      }
      currentDownloadIdRef.current = null;
      currentDownloadVideoIdRef.current = null;
    };
  }, [stopJobPolling]);

  const handleGenerateShorts = async () => {
    if (!selectedVideo) {
      setNotification("Select a video from the sidebar to analyze first.");
      return;
    }

    try {
      setIsLoading(true);
      setNotification("Analyzing selected video for high-impact moments…");
      const generatedClips = await fetchShortIdeas(selectedVideo.id, selectedVideo.title);

      if (!generatedClips.length) {
        setNotification("No strong shorts candidates were identified for this video.");
      } else {
        setNotification(`Found ${generatedClips.length} potential short${generatedClips.length > 1 ? "s" : ""}.`);
      }

      setShorts(generatedClips);
    } catch (error) {
      console.error("[shorts] failed to generate ideas", error);
      setNotification(error instanceof Error ? error.message : "Failed to analyze video for shorts.");
      setShorts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishShort = async (clipIndex: number) => {
    if (!selectedVideo) {
      setNotification("Select a video before publishing.");
      return;
    }
    if (!downloadId) {
      setNotification("Preparing video download. Please wait a moment and try again.");
      return;
    }
    const clip = shorts[clipIndex];
    if (!clip) {
      setNotification("Unable to locate clip details for publishing.");
      return;
    }

    setPublishingIndex(clipIndex);
    setNotification("Short creation initiated. We’ll update you once it’s ready.");

    try {
      const publication = await publishShortClip({
        videoId: selectedVideo.id,
        clip,
        videoTitle: selectedVideo.title,
        downloadId,
      });
      setPublishResults((prev) => ({
        ...prev,
        [clipIndex]: publication,
      }));

      if (publication.jobId) {
        startJobPolling(publication.jobId, clipIndex);
      }

      const statusLabel = publication.status === "completed" ? "published" : publication.status;
      const baseMessage =
        publication.message ??
        `Short ${clipIndex + 1} ${statusLabel}. ${publication.shareUrl ? "Preview link ready." : ""}`.trim();
      setNotification(baseMessage || "Short creation in progress.");
    } catch (error) {
      console.error("[shorts] failed to publish clip", error);
      setNotification(error instanceof Error ? error.message : "Failed to publish short.");
    } finally {
      setPublishingIndex(null);
    }
  };

  const videoThumbnail = useMemo(() => {
    if (!selectedVideo?.thumbnails) return null;
    const thumbnails = selectedVideo.thumbnails as Record<
      string,
      { url?: string; width?: number; height?: number }
    >;
    const preferredOrder = ["maxres", "standard", "high", "medium", "default"];
    for (const key of preferredOrder) {
      const thumbnail = thumbnails[key];
      if (thumbnail?.url) {
        return thumbnail.url;
      }
    }
    const fallback = Object.values(thumbnails).find((thumb) => thumb?.url);
    return fallback?.url ?? null;
  }, [selectedVideo]);

  const handleClear = () => {
    setShorts([]);
    setNotification("Cleared suggestions.");
    setPublishResults({});
    setPublishingIndex(null);
    stopJobPolling();
  };

  return (
    <section className="space-y-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-semibold text-white drop-shadow-sm">Shorts Generator</h2>
      </div>

      {notification && (
        <div
          className="mb-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 text-sm text-sky-100 shadow-inner shadow-sky-500/10"
          role="alert"
        >
          {notification}
        </div>
      )}

      <div className="space-y-6">
        <Card title="1. Select a Video">
          {!selectedVideo && (
            <div className="text-sm text-white/60">
              Choose a video from the sidebar to start generating short-form ideas.
            </div>
          )}
          {selectedVideo && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {videoThumbnail && (
                  <img
                    src={videoThumbnail}
                    alt={selectedVideo.title}
                    className="h-20 w-32 rounded-xl border border-white/10 object-cover shadow-[0_12px_30px_rgba(15,23,42,0.5)]"
                  />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-white">{selectedVideo.title}</h3>
                  {downloadStatus && (
                    <p className="mt-1 text-xs text-indigo-200">{getDownloadStatusLabel(downloadStatus)}</p>
                  )}
                  {selectedVideo.publishedAt && (
                    <p className="mt-1 text-xs text-white/60">
                      Published {new Date(selectedVideo.publishedAt).toLocaleDateString()}
                    </p>
                  )}
                  {selectedVideo.description && (
                    <p className="mt-2 text-xs text-white/60">
                      {selectedVideo.description.split('\n')[0]}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateShorts}
                  disabled={isLoading}
                  className="rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(99,102,241,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(99,102,241,0.45)] disabled:cursor-wait disabled:bg-white/10 disabled:text-white/50 disabled:shadow-none"
                >
                  {isLoading ? "Analyzing…" : "Generate Clip Ideas"}
                </button>
                <button
                  onClick={handleClear}
                  disabled={isLoading}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card title="2. Review & Export Clips">
          {!selectedVideo && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
              Select a video to see suggested clips and timestamps here.
            </div>
          )}
          {selectedVideo && (
            <>
              {isLoading && (
                <div className="flex h-full items-center justify-center text-sm text-white/60">
                  Finding the best moments…
                </div>
              )}
              {!isLoading && shorts.length === 0 && (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/60">
                  Your suggested clips will appear here once generated.
                </div>
              )}
              <ul className="space-y-3 mt-2">
                {shorts.map((clip, index) => {
                  const duration = clip.endTime - clip.startTime;
                  return (
                    <li
                      key={`${clip.startTime}-${clip.endTime}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
                            {formatSeconds(clip.startTime)} → {formatSeconds(clip.endTime)} ({formatSeconds(duration)})
                          </div>
                          <button
                            onClick={() => handlePublishShort(index)}
                            disabled={publishingIndex === index}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-wait disabled:opacity-50"
                          >
                            {publishingIndex === index ? "Publishing…" : "Publish Short"}
                          </button>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{clip.title}</h4>
                          <p className="mt-1 text-xs text-white/70">{clip.reason}</p>
                          <p className="mt-1 text-xs italic text-white/50">Hook: {clip.hook}</p>
                          {publishResults[index] && (
                            <div className="mt-3 space-y-1 text-xs text-emerald-200">
                              <div className="font-semibold uppercase tracking-wide text-white/60">Status: <span className="text-emerald-200 normal-case tracking-normal font-normal">{publishResults[index].status}</span></div>
                              {publishResults[index].message && (
                                <div className="text-emerald-200">{publishResults[index].message}</div>
                              )}
                              {publishResults[index].shareUrl && (
                                <div>
                                  <a
                                    href={publishResults[index].shareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-200 underline hover:text-emerald-100"
                                  >
                                    Preview clip on YouTube
                                  </a>
                                </div>
                              )}
                              {publishResults[index].estimatedProcessingSeconds && (
                                <div>
                                  Est. processing time:{" "}
                                  {Math.ceil(publishResults[index].estimatedProcessingSeconds / 60)} min
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </section>
  );
};

export default ShortsGeneratorTab;

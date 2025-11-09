import { API_BASE_URL } from "../constants";
import {
  ChannelAnalyticsOverview,
  VideoAnalyticsOverview,
  Video,
} from "../types";

const apiBaseUrl = API_BASE_URL.replace(/\/$/, "");

interface StartDemoResponse {
  success: boolean;
  user?: unknown;
  channel?: unknown;
}

const startDemoSession = async (): Promise<StartDemoResponse> => {
  const response = await fetch(`${apiBaseUrl}/demo/start`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Demo start failed (status ${response.status})`;
    throw new Error(message);
  }

  return payload as StartDemoResponse;
};

const fetchDemoChannel = async () => {
  const response = await fetch(`${apiBaseUrl}/demo/channel`, {
    credentials: "include",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Failed to load demo channel (status ${response.status})`;
    throw new Error(message);
  }

  return payload;
};

interface FetchDemoVideosParams {
  query?: string;
  pageToken?: string | null;
  pageSize?: number;
  source?: "search" | "uploads";
}

interface FetchDemoVideosResponse {
  videos: Video[];
  nextPageToken: string | null;
  prevPageToken: string | null;
}

const fetchDemoVideos = async ({
  query,
  pageToken,
  pageSize,
  source = "search",
  signal,
}: FetchDemoVideosParams & { signal?: AbortSignal }): Promise<FetchDemoVideosResponse> => {
  const url = new URL(`${apiBaseUrl}/demo/videos`);
  if (query) url.searchParams.set("q", query);
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  if (pageSize) url.searchParams.set("pageSize", String(pageSize));
  if (source === "uploads") url.searchParams.set("source", "uploads");

  const response = await fetch(url.toString(), {
    credentials: "include",
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Failed to load demo videos (status ${response.status})`;
    throw new Error(message);
  }

  return payload as FetchDemoVideosResponse;
};

const fetchDemoChannelAnalytics = async (
  rangeDays?: number,
  signal?: AbortSignal,
): Promise<{ analytics: ChannelAnalyticsOverview }> => {
  const url = new URL(`${apiBaseUrl}/demo/analytics/overview`);
  if (rangeDays) {
    url.searchParams.set("rangeDays", String(rangeDays));
  }

  const response = await fetch(url.toString(), {
    credentials: "include",
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Failed to load demo analytics (status ${response.status})`;
    throw new Error(message);
  }

  return payload as { analytics: ChannelAnalyticsOverview };
};

const fetchDemoVideoAnalytics = async (
  videoId: string,
  rangeDays?: number,
  signal?: AbortSignal,
): Promise<{ analytics: VideoAnalyticsOverview }> => {
  if (!videoId) {
    throw new Error("videoId is required to retrieve demo video analytics.");
  }

  const url = new URL(`${apiBaseUrl}/demo/analytics/video`);
  url.searchParams.set("videoId", videoId);
  if (rangeDays) {
    url.searchParams.set("rangeDays", String(rangeDays));
  }

  const response = await fetch(url.toString(), {
    credentials: "include",
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Failed to load demo video analytics (status ${response.status})`;
    throw new Error(message);
  }

  return payload as { analytics: VideoAnalyticsOverview };
};

export {
  startDemoSession,
  fetchDemoChannel,
  fetchDemoVideos,
  fetchDemoChannelAnalytics,
  fetchDemoVideoAnalytics,
};



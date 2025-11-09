import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

export async function getOAuth2Client(tokens) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || process.env.OAUTH2_REDIRECT_URI || "http://localhost:5173/oauth2callback"
  );

  console.log("OAuth2 client created YOUTUBE MODEL");

  // If tokens are provided (from session), attach them so downstream
  // google API calls have access/refresh tokens available.
  if (tokens && typeof tokens === "object") {
    // Normalize token keys to what google-auth-library expects
    const normalized = {};
    if (tokens.access_token) normalized.access_token = tokens.access_token;
    if (tokens.refresh_token) normalized.refresh_token = tokens.refresh_token;
    if (tokens.accessToken) normalized.access_token = tokens.accessToken;
    if (tokens.refreshToken) normalized.refresh_token = tokens.refreshToken;
    if (tokens.scope) normalized.scope = tokens.scope;
    if (tokens.token_type) normalized.token_type = tokens.token_type;
    if (tokens.tokenType) normalized.token_type = tokens.tokenType;
    if (tokens.expiry_date) normalized.expiry_date = tokens.expiry_date;
    if (tokens.expiryDate) normalized.expiry_date = tokens.expiryDate;

    oauth2Client.setCredentials(normalized);
    console.log("OAuth2 client credentials set from session tokens (normalized)");
  } else {
    console.log("No tokens provided to OAuth2 client; API calls may fail without auth");
  }

  return oauth2Client;
}

export async function getChannelVideos(auth, channelId) {
  const youtube = google.youtube({ version: "v3", auth });
  try {
    const res = await youtube.channels.list({
      part: ["contentDetails"],
      id: [channelId],
    });
    console.log("Channel details fetched");

    const uploadsId = res.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
      // If the uploads playlist isn't found, provide an informative error
      const msg = `No uploads playlist found for channel ${channelId}. Response items: ${JSON.stringify(res.data.items?.map(i => i.id))}`;
      console.warn(msg);
      throw new Error(msg);
    }

    const videos = [];
    const videoIds = [];
    let nextPageToken = undefined;

    do {
      const plRes = await youtube.playlistItems.list({
        part: ["snippet"],
        playlistId: uploadsId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      plRes.data.items?.forEach((item) => {
        const videoId = item.snippet?.resourceId?.videoId;
        if (!videoId) {
          return;
        }

        videoIds.push(videoId);
        videos.push({
          id: videoId,
          title: item.snippet?.title,
          publishedAt: item.snippet?.publishedAt,
          description: item.snippet?.description,
        });
      });

      console.log("Fetched a page of channel videos");

      nextPageToken = plRes.data.nextPageToken;
    } while (nextPageToken);

    if (videoIds.length === 0) {
      return videos;
    }

    const detailedMap = new Map();
    const chunkSize = 50;
    for (let i = 0; i < videoIds.length; i += chunkSize) {
      const chunk = videoIds.slice(i, i + chunkSize);
      const detailRes = await youtube.videos.list({
        id: chunk,
        part: ["snippet", "statistics"],
      });

      detailRes.data.items?.forEach((video) => {
        if (video?.id) {
          detailedMap.set(video.id, video);
        }
      });
    }

    return videos.map((video) => {
      const detail = detailedMap.get(video.id) || {};
      const detailSnippet = detail.snippet || {};
      const detailStats = detail.statistics || {};

      return {
        id: video.id,
        title: video.title,
        publishedAt: detailSnippet.publishedAt || video.publishedAt || null,
        description: detailSnippet.description || video.description || "",
        viewCount: Number(detailStats.viewCount || 0),
        likeCount: Number(detailStats.likeCount || 0),
        commentCount: Number(detailStats.commentCount || 0),
      };
    });
  } catch (err) {
    // Improve error message for upstream callers
    console.error("getChannelVideos error:", err?.message || err);
    // Re-throw so the route handler can return a 500 with details
    throw err;
  }
}

export async function getTrendingVideos(auth, regionCode = "US") {
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.videos.list({
    part: ["snippet", "statistics"],
    chart: "mostPopular",
    regionCode,
    maxResults: 20,
  });
  console.log("Trending videos fetched");

  return res.data.items?.map(item => ({
    title: item.snippet?.title,
    category: item.snippet?.categoryId,
    views: item.statistics?.viewCount,
  })) || [];

}

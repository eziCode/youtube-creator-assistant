import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

export async function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:5173/oauth2callback"
  );

  console.log("OAuth2 client created YOUTUBE MODEL");

  auth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return oauth2Client;
}

export async function getChannelVideos(auth, channelId) {
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.channels.list({
    part: ["contentDetails"],
    id: [channelId],
  });
  console.log("Channel details fetched");
  const uploadsId = res.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  const videos = [];
  let nextPageToken = undefined;

  do {
    const plRes = await youtube.playlistItems.list({
      part: ["snippet"],
      playlistId: uploadsId,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    plRes.data.items?.forEach(item => {
      videos.push({
        id: item.snippet?.resourceId?.videoId,
        title: item.snippet?.title,
      });
    });

    console.log("Fetched a page of channel videos");

    nextPageToken = plRes.data.nextPageToken;
  } while (nextPageToken);

  return videos;
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

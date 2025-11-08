import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

export async function downloadYouTubeVideo(videoId, outputDir = "./downloads") {
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(outputDir, `${videoId}.mp4`);

    // Create command
    const command = `yt-dlp -f "best" -o "${outputPath}" "${videoUrl}"`;

    console.log(`🎬 Downloading ${videoUrl} ...`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ yt-dlp error:", stderr);
        return reject(error);
      }
      console.log("✅ Download complete:", outputPath);
      resolve(outputPath);
    });
  });
}

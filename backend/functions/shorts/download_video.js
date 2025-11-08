import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "downloads");

export class DownloadAbortedError extends Error {
	constructor(message = "Download aborted.") {
		super(message);
		this.name = "DownloadAbortedError";
	}
}

const ensureDirectory = async (dirPath) => {
	await fs.mkdir(dirPath, { recursive: true });
};

/**
 * Downloads a YouTube video using yt-dlp with support for cancellation through an AbortSignal.
 * Resolves with the absolute path to the downloaded file.
 */
export async function downloadYouTubeVideo(
	videoId,
	{ outputDir = DEFAULT_OUTPUT_DIR, signal, logger = console } = {}
) {
	if (!videoId || typeof videoId !== "string") {
		throw new Error("A valid videoId is required to download a YouTube video.");
	}

	const resolvedOutputDir = path.resolve(outputDir ?? DEFAULT_OUTPUT_DIR);
	await ensureDirectory(resolvedOutputDir);

	const outputPath = path.join(resolvedOutputDir, `${videoId}.mp4`);
	const tempPath = `${outputPath}.part`;
	const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

	logger?.info?.("[downloadYouTubeVideo] starting download", {
		videoId,
		outputPath,
	});

	return new Promise((resolve, reject) => {
		let aborted = false;
		const child = spawn(
			"yt-dlp",
			["-f", "best", "--no-part", "-o", outputPath, videoUrl],
			{
				stdio: ["ignore", "pipe", "pipe"],
			}
		);

		const cleanupTempFile = async () => {
			try {
				await fs.rm(tempPath, { force: true });
			} catch {
				// ignore
			}
		};

		const handleAbort = async () => {
			if (aborted) {
				return;
			}
			aborted = true;
			logger?.warn?.("[downloadYouTubeVideo] aborting download", { videoId });
			child.kill("SIGKILL");
			await cleanupTempFile();
		};

		if (signal) {
			if (signal.aborted) {
				void handleAbort();
			} else {
				signal.addEventListener("abort", () => {
					void handleAbort();
				});
			}
		}

		child.stdout?.on("data", (data) => {
			logger?.debug?.("[downloadYouTubeVideo] yt-dlp stdout", data.toString());
		});

		child.stderr?.on("data", (data) => {
			logger?.debug?.("[downloadYouTubeVideo] yt-dlp stderr", data.toString());
		});

		child.on("error", async (error) => {
			await cleanupTempFile();
			if (aborted) {
				return reject(new DownloadAbortedError());
			}
			logger?.error?.("[downloadYouTubeVideo] failed to spawn yt-dlp", error);
			reject(error);
		});

		child.on("close", async (code) => {
			if (code === 0 && !aborted) {
				logger?.info?.("[downloadYouTubeVideo] download complete", {
					videoId,
					outputPath,
				});
				resolve(outputPath);
				return;
			}

			await cleanupTempFile();

			if (aborted) {
				reject(new DownloadAbortedError());
				return;
			}

			const error = new Error(`yt-dlp exited with code ${code ?? "unknown"}`);
			logger?.error?.("[downloadYouTubeVideo] download failed", {
				videoId,
				code,
			});
			reject(error);
		});
	});
}

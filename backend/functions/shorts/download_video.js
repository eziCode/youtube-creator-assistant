import { spawn } from "child_process";
import { uploadSourceVideoFromStream } from "./video_storage.js";

export class DownloadAbortedError extends Error {
	constructor(message = "Download aborted.") {
		super(message);
		this.name = "DownloadAbortedError";
	}
}

export async function downloadYouTubeVideo(
	videoId,
	{ downloadId, signal, logger = console } = {}
) {
	if (!videoId || typeof videoId !== "string") {
		throw new Error("A valid videoId is required to download a YouTube video.");
	}

	const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

	logger?.info?.("[downloadYouTubeVideo] starting download", {
		videoId,
		downloadId,
	});

	return new Promise((resolve, reject) => {
		let aborted = false;
		const child = spawn(
			"yt-dlp",
			["-f", "best", "--no-part", "-o", "-", videoUrl],
			{
				stdio: ["ignore", "pipe", "pipe"],
			}
		);

		let uploader;
		try {
			uploader = uploadSourceVideoFromStream({
				stream: child.stdout,
				videoId,
				downloadId,
			});
		} catch (error) {
			child.kill("SIGKILL");
			reject(error);
			return;
		}

		const handleAbort = async () => {
			if (aborted) {
				return;
			}
			aborted = true;
			logger?.warn?.("[downloadYouTubeVideo] aborting download", { videoId });
			child.kill("SIGKILL");
			try {
				await uploader?.abort(new DownloadAbortedError());
			} catch {
				// ignore
			}
			discardUploadPromiseRejection();
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

		child.stdout?.on("error", (error) => {
			logger?.warn?.("[downloadYouTubeVideo] stdout stream error", {
				videoId,
				error: error?.message,
			});
			discardUploadPromiseRejection();
			void handleFailure(error);
		});

		const uploadPromise = uploader.promise;
		const discardUploadPromiseRejection = () => {
			void uploadPromise.catch(() => undefined);
		};

		const handleFailure = async (error) => {
			if (aborted) {
				discardUploadPromiseRejection();
				return reject(new DownloadAbortedError());
			}
			try {
				await uploader.abort(error);
			} catch {
				// ignore
			}
			discardUploadPromiseRejection();
			logger?.error?.("[downloadYouTubeVideo] download failed", {
				videoId,
				error: error?.message,
			});
			reject(error);
		};

		child.on("error", async (error) => {
			try {
				await uploader.abort(error);
			} catch {
				// ignore
			}
			discardUploadPromiseRejection();
			if (aborted) {
				return reject(new DownloadAbortedError());
			}
			logger?.error?.("[downloadYouTubeVideo] failed to spawn yt-dlp", error);
			reject(error);
		});

		child.on("close", async (code) => {
			if (code === 0 && !aborted) {
				try {
					const uploadResult = await uploadPromise;
					logger?.info?.("[downloadYouTubeVideo] download complete", {
						videoId,
						fileId: uploadResult?.fileId?.toString?.() ?? uploadResult?.fileId,
					});
					resolve(uploadResult);
					return;
				} catch (error) {
					await handleFailure(error);
					return;
				}
			}

			if (aborted) {
				discardUploadPromiseRejection();
				reject(new DownloadAbortedError());
				return;
			}

			const error = new Error(`yt-dlp exited with code ${code ?? "unknown"}`);
			await handleFailure(error);
		});
	});
}

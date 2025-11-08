import { randomUUID } from "crypto";
import EventEmitter from "events";
import fs from "fs/promises";
import path from "path";
import { downloadYouTubeVideo, DownloadAbortedError } from "./download_video.js";

const safeDelete = async (targetPath) => {
	if (!targetPath) return;
	try {
		await fs.rm(targetPath, { force: true });
	} catch {
		// ignore
	}
};

const downloads = new Map();

export const DownloadStatus = Object.freeze({
	PENDING: "pending",
	DOWNLOADING: "downloading",
	COMPLETED: "completed",
	CANCELLED: "cancelled",
	FAILED: "failed",
});

const buildLogger = (baseLogger = console, context = {}) => {
	const prefix = "[ShortsDownload]";
	return {
		debug: (message, meta) => baseLogger?.debug?.(prefix, message, { ...context, ...meta }),
		info: (message, meta) => baseLogger?.info?.(prefix, message, { ...context, ...meta }),
		warn: (message, meta) => baseLogger?.warn?.(prefix, message, { ...context, ...meta }),
		error: (message, meta) => baseLogger?.error?.(prefix, message, { ...context, ...meta }),
	};
};

const createDownloadRecord = ({ id, videoId, sessionId, outputDir, logger }) => ({
	id,
	videoId,
	sessionId,
	outputDir,
	status: DownloadStatus.PENDING,
	filePath: null,
	error: null,
	startedAt: new Date(),
	completedAt: null,
	controller: new AbortController(),
	emitter: new EventEmitter(),
	logger: buildLogger(logger, { downloadId: id, videoId, sessionId }),
	waitPromise: null,
});

const updateRecordStatus = (record, statusUpdate) => {
	Object.assign(record, statusUpdate);
	record.emitter.emit("status", record);
};

const resolveOutputPath = (record) => {
	if (record.filePath) {
		return record.filePath;
	}
	return path.resolve(record.outputDir, `${record.videoId}.mp4`);
};

export const startDownload = async ({
	videoId,
	sessionId,
	outputDir,
	logger = console,
}) => {
	if (!sessionId) {
		throw new Error("sessionId is required to start a download.");
	}

	const id = randomUUID();
	const record = createDownloadRecord({ id, videoId, sessionId, outputDir, logger });
	downloads.set(id, record);

	updateRecordStatus(record, { status: DownloadStatus.DOWNLOADING });

	const downloadPromise = downloadYouTubeVideo(videoId, {
		outputDir,
		signal: record.controller.signal,
		logger: record.logger,
	})
		.then((filePath) => {
			updateRecordStatus(record, {
				status: DownloadStatus.COMPLETED,
				filePath,
				completedAt: new Date(),
			});
			return filePath;
		})
		.catch((error) => {
			const status =
				error instanceof DownloadAbortedError
					? DownloadStatus.CANCELLED
					: DownloadStatus.FAILED;
			updateRecordStatus(record, {
				status,
				error,
				completedAt: new Date(),
			});
			if (status === DownloadStatus.CANCELLED) {
				throw error;
			}
			throw Object.assign(
				new Error(`Failed to download video ${videoId}`),
				{ cause: error }
			);
		});

	record.waitPromise = downloadPromise;

	return {
		id: record.id,
		status: record.status,
		videoId: record.videoId,
		startedAt: record.startedAt,
	};
};

export const getDownload = (id) => {
	if (!id) return null;
	const record = downloads.get(id);
	if (!record) {
		return null;
	}
	return {
		id: record.id,
		videoId: record.videoId,
		sessionId: record.sessionId,
		status: record.status,
		filePath: record.filePath,
		error: record.error,
		startedAt: record.startedAt,
		completedAt: record.completedAt,
	};
};

export const cancelDownload = async (id, { deleteFile = false } = {}) => {
	const record = downloads.get(id);
	if (!record) {
		return false;
	}

	if (
		record.status === DownloadStatus.CANCELLED ||
		record.status === DownloadStatus.COMPLETED ||
		record.status === DownloadStatus.FAILED
	) {
		if (deleteFile && record.filePath) {
			await safeDelete(record.filePath);
			updateRecordStatus(record, { filePath: null });
		}
		return true;
	}

	record.controller.abort();

	try {
		await record.waitPromise;
	} catch (error) {
		if (!(error instanceof DownloadAbortedError)) {
			record.logger.error("Download cancellation encountered an error", { error });
		}
	}

	if (deleteFile) {
		const filePath = resolveOutputPath(record);
		await safeDelete(filePath);
		updateRecordStatus(record, { filePath: null });
	}

	return true;
};

export const awaitDownload = async (id) => {
	const record = downloads.get(id);
	if (!record) {
		throw new Error("Download not found.");
	}
	return record.waitPromise;
};

export const deleteDownloadFile = async (id) => {
	const record = downloads.get(id);
	if (!record?.filePath) {
		return false;
	}
	await safeDelete(record.filePath);
	updateRecordStatus(record, { filePath: null });
	return true;
};

export const subscribeToDownload = (id, listener) => {
	const record = downloads.get(id);
	if (!record) return () => {};
	record.emitter.on("status", listener);
	return () => {
		record.emitter.off("status", listener);
	};
};

export const getActiveDownloadForSession = (sessionId) => {
	if (!sessionId) return null;
	for (const record of downloads.values()) {
		if (record.sessionId === sessionId) {
			return {
				id: record.id,
				videoId: record.videoId,
				status: record.status,
				filePath: record.filePath,
			};
		}
	}
	return null;
};



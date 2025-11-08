import { randomUUID } from "crypto";
import EventEmitter from "events";
import { downloadYouTubeVideo, DownloadAbortedError } from "./download_video.js";
import { deleteSourceVideo } from "./video_storage.js";

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

const createDownloadRecord = ({ id, videoId, sessionId, logger }) => ({
	id,
	videoId,
	sessionId,
	status: DownloadStatus.PENDING,
	fileId: null,
	filename: null,
	fileLength: null,
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

export const startDownload = async ({ videoId, sessionId, logger = console }) => {
	if (!sessionId) {
		throw new Error("sessionId is required to start a download.");
	}

	const id = randomUUID();
	const record = createDownloadRecord({ id, videoId, sessionId, logger });
	downloads.set(id, record);

	updateRecordStatus(record, { status: DownloadStatus.DOWNLOADING });

	const downloadPromise = downloadYouTubeVideo(videoId, {
		downloadId: id,
		signal: record.controller.signal,
		logger: record.logger,
	})
		.then((uploadResult) => {
			updateRecordStatus(record, {
				status: DownloadStatus.COMPLETED,
				fileId: uploadResult?.fileId ?? null,
				filename: uploadResult?.filename ?? null,
				fileLength: uploadResult?.length ?? null,
				completedAt: new Date(),
			});
			return uploadResult;
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
		fileId: record.fileId ? record.fileId.toString() : null,
		filename: record.filename,
		fileLength: record.fileLength,
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
		if (deleteFile && record.fileId) {
			await deleteSourceVideo(record.fileId).catch(() => undefined);
			updateRecordStatus(record, { fileId: null, filename: null, fileLength: null });
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
		if (record.fileId) {
			await deleteSourceVideo(record.fileId).catch(() => undefined);
			updateRecordStatus(record, { fileId: null, filename: null, fileLength: null });
		}
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
				fileId: record.fileId ? record.fileId.toString() : null,
				filename: record.filename,
				fileLength: record.fileLength,
			};
		}
	}
	return null;
};



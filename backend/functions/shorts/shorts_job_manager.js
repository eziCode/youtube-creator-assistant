import { randomUUID } from "crypto";
import EventEmitter from "events";
import fs from "fs/promises";
import path from "path";
import {
	awaitDownload,
	getDownload,
	cancelDownload,
	DownloadStatus as DownloadJobStatus,
} from "./download_manager.js";
import { trimVideo } from "./trim_video.js";
import { uploadShortVideo } from "./upload_video.js";
import { DownloadAbortedError } from "./download_video.js";

const jobs = new Map();

const INTERNAL_STATUS = Object.freeze({
	QUEUED: "queued",
	PROCESSING: "processing",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
});

const DEFAULT_TRIM_OUTPUT_DIR = path.resolve(process.cwd(), "trimmed_content");

const buildLogger = (baseLogger = console, context = {}) => {
	const prefix = "[ShortsJob]";
	return {
		info: (message, meta) => baseLogger?.info?.(prefix, message, { ...context, ...meta }),
		debug: (message, meta) => baseLogger?.debug?.(prefix, message, { ...context, ...meta }),
		warn: (message, meta) => baseLogger?.warn?.(prefix, message, { ...context, ...meta }),
		error: (message, meta) => baseLogger?.error?.(prefix, message, { ...context, ...meta }),
	};
};

const createRecord = ({
	downloadId,
	videoId,
	clip,
	videoTitle,
	tokens,
	sessionId,
	sessionStore,
	logger,
}) => {
	const id = randomUUID();
	return {
		id,
		downloadId,
		videoId,
		clip,
		videoTitle: videoTitle ?? "",
		sessionId,
		sessionStore,
		initialTokens: tokens,
		status: INTERNAL_STATUS.QUEUED,
		step: "queued",
		message: "Short creation queued.",
		createdAt: new Date(),
		updatedAt: new Date(),
		logger: buildLogger(logger, { jobId: id, videoId }),
		emitter: new EventEmitter(),
		result: null,
		error: null,
		trimmedPath: null,
		uploadResult: null,
	};
};

const updateRecord = (record, update) => {
	Object.assign(record, update, { updatedAt: new Date() });
	record.emitter.emit("status", record);
};

const buildExternalPublication = (record) => {
	const shareUrl =
		record?.uploadResult?.videoId
			? `https://www.youtube.com/watch?v=${record.uploadResult.videoId}`
			: undefined;

	const normalizedStatus = (() => {
		switch (record.status) {
			case INTERNAL_STATUS.QUEUED:
				return "queued";
			case INTERNAL_STATUS.PROCESSING:
				return "processing";
			case INTERNAL_STATUS.COMPLETED:
				return "completed";
			case INTERNAL_STATUS.CANCELLED:
			case INTERNAL_STATUS.FAILED:
			default:
				return "failed";
		}
	})();

	return {
		jobId: record.id,
		status: normalizedStatus,
		shareUrl,
		message: record.message,
		metadata: {
			videoId: record.videoId,
			startTime: record.clip?.startTime ?? null,
			endTime: record.clip?.endTime ?? null,
			title: record.clip?.title,
			hook: record.clip?.hook,
			reason: record.clip?.reason,
		},
	};
};

const updateSessionTokens = async (record, updatedTokens) => {
	if (!record?.sessionStore || !record?.sessionId || !updatedTokens) {
		return;
	}
	return new Promise((resolve) => {
		record.sessionStore.get(record.sessionId, (getErr, sessionData) => {
			if (getErr || !sessionData) {
				record.logger.warn("Unable to retrieve session for token update", {
					error: getErr,
				});
				return resolve();
			}

			sessionData.tokens = {
				...(sessionData.tokens ?? {}),
				...updatedTokens,
			};

			record.sessionStore.set(record.sessionId, sessionData, (setErr) => {
				if (setErr) {
					record.logger.warn("Failed to persist updated tokens to session store", {
						error: setErr,
					});
				}
				resolve();
			});
		});
	});
};

const disposeTrimmedFile = async (filePath, logger) => {
	if (!filePath) return;
	try {
		await fs.rm(filePath, { force: true });
	} catch (error) {
		logger?.warn?.("Failed to clean up trimmed file", { filePath, error });
	}
};

const runJob = async (record) => {
	try {
		updateRecord(record, {
			status: INTERNAL_STATUS.PROCESSING,
			step: "waiting_for_download",
			message: "Waiting for source video download to finish…",
		});

		const downloadInfo = getDownload(record.downloadId);
		if (!downloadInfo) {
			throw new Error("Associated video download could not be found.");
		}

		const videoPath = await awaitDownload(record.downloadId);

		updateRecord(record, {
			step: "trimming",
			message: "Trimming clip from source video…",
		});

		const trimmedPath = await trimVideo(videoPath, [record.clip.startTime, record.clip.endTime], {
			outputDir: DEFAULT_TRIM_OUTPUT_DIR,
			overwrite: true,
		});

		record.trimmedPath = trimmedPath;

		updateRecord(record, {
			step: "uploading",
			message: "Uploading short to YouTube…",
		});

		const uploadResult = await uploadShortVideo({
			filePath: trimmedPath,
			title: record.clip?.title ?? `Short from ${record.videoTitle || "video"}`,
			description: record.clip?.reason
				? `${record.clip.reason}\n\nOriginal video: https://www.youtube.com/watch?v=${record.videoId}`
				: `Auto-generated short from ${record.videoTitle || "video"}.`,
			tags: ["shorts", "youtube", "clip"].concat(record.clip?.hook ? [record.clip.hook] : []),
			privacyStatus: "private",
			madeForKids: false,
			tokens: record.initialTokens,
		});

		record.uploadResult = uploadResult;
		updateRecord(record, {
			status: INTERNAL_STATUS.COMPLETED,
			step: "completed",
			message: "Short uploaded successfully.",
		});
		record.result = buildExternalPublication(record);

		await updateSessionTokens(record, uploadResult?.updatedTokens);
	} catch (error) {
		record.error = error;

		const isAbort =
			error instanceof DownloadAbortedError ||
			error?.cause instanceof DownloadAbortedError;

		const status = isAbort ? INTERNAL_STATUS.CANCELLED : INTERNAL_STATUS.FAILED;

		updateRecord(record, {
			status,
			step: "error",
			message: isAbort
				? "Short creation cancelled because the download was interrupted."
				: error?.message ?? "Short creation failed.",
		});

		if (!isAbort) {
			record.logger.error("Short job failed", { error });
		} else {
			record.logger.warn("Short job cancelled", { error: error?.message });
		}
	} finally {
		if (record.trimmedPath) {
			await disposeTrimmedFile(record.trimmedPath, record.logger);
		}
	}
};

export const createShortJob = ({
	downloadId,
	videoId,
	clip,
	videoTitle,
	tokens,
	sessionId,
	sessionStore,
	logger = console,
}) => {
	if (!downloadId) {
		throw new Error("downloadId is required to create a short job.");
	}
	if (!clip || typeof clip.startTime !== "number" || typeof clip.endTime !== "number") {
		throw new Error("clip with valid startTime and endTime is required.");
	}

	const record = createRecord({
		downloadId,
		videoId,
		clip,
		videoTitle,
		tokens,
		sessionId,
		sessionStore,
		logger,
	});
	jobs.set(record.id, record);

	setImmediate(() => {
		runJob(record).catch((err) => {
			record.logger.error("Unexpected failure while running job", { error: err });
			updateRecord(record, {
				status: INTERNAL_STATUS.FAILED,
				step: "error",
				message: err?.message ?? "Short creation failed.",
			});
		});
	});

	return buildExternalPublication(record);
};

export const getJob = (jobId, { sessionId } = {}) => {
	const record = jobs.get(jobId);
	if (!record) return null;
	if (sessionId && record.sessionId !== sessionId) {
		return null;
	}
	return buildExternalPublication(record);
};

export const subscribeToJob = (jobId, listener) => {
	const record = jobs.get(jobId);
	if (!record) {
		return () => {};
	}
	record.emitter.on("status", () => {
		listener(buildExternalPublication(record));
	});
	return () => {
		record.emitter.off("status", listener);
	};
};

export const cancelJob = async (jobId, { sessionId } = {}) => {
	const record = jobs.get(jobId);
	if (!record) return false;
	if (sessionId && record.sessionId !== sessionId) {
		return false;
	}
	await cancelDownload(record.downloadId, { deleteFile: false });
	updateRecord(record, {
		status: INTERNAL_STATUS.CANCELLED,
		step: "cancelled",
		message: "Short creation cancelled by user.",
	});
	return true;
};

export const listJobsForSession = (sessionId) => {
	const publications = [];
	for (const record of jobs.values()) {
		if (record.sessionId === sessionId) {
			publications.push(buildExternalPublication(record));
		}
	}
	return publications;
};



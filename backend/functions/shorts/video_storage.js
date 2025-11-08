import crypto from "crypto";
import { createWriteStream } from "fs";
import { mkdir, mkdtemp } from "fs/promises";
import mongoose from "mongoose";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { ObjectId } from "mongodb";

const BUCKET_NAME = "shorts_source_videos";
const TEMP_DIR_PREFIX = "shorts-source-";

let gridFsBucket;

const ensureBucket = () => {
	if (gridFsBucket) {
		return gridFsBucket;
	}

	const db = mongoose.connection?.db;
	if (!db) {
		throw new Error("MongoDB connection is not ready for GridFS operations.");
	}

	gridFsBucket = new mongoose.mongo.GridFSBucket(db, {
		bucketName: BUCKET_NAME,
	});

	return gridFsBucket;
};

export const uploadSourceVideoFromStream = ({ stream, videoId, downloadId }) => {
	if (!stream) {
		throw new Error("A readable stream is required to upload the source video.");
	}
	const bucket = ensureBucket();

	const filename = `${videoId || "video"}-${Date.now()}.mp4`;
	const metadata = {
		videoId,
		downloadId,
	};

	let uploadStream;
	let settled = false;
	let rejectFn;
	let onError;
	let onFinish;

	const cleanup = () => {
		if (onError) {
			stream.off?.("error", onError);
			uploadStream?.off("error", onError);
		}
		if (onFinish) {
			uploadStream?.off("finish", onFinish);
		}
	};

	const uploadPromise = new Promise((resolve, reject) => {
		rejectFn = reject;
		uploadStream = bucket.openUploadStream(filename, {
			contentType: "video/mp4",
			metadata,
		});

		onError = async (error) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			try {
				await uploadStream.abort();
			} catch {
				// ignore
			}
			reject(error);
		};

		onFinish = () => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve({
				fileId: uploadStream.id,
				filename: uploadStream.filename,
				length: uploadStream.length,
			});
		};

		uploadStream.once("error", onError);
		uploadStream.once("finish", onFinish);

		stream.once("error", onError);
		stream.pipe(uploadStream);
	});

	const abort = async (reason = new Error("Upload aborted")) => {
		if (settled) {
			return;
		}
		settled = true;
		cleanup();
		try {
			stream.destroy(reason);
		} catch {
			// ignore
		}
		try {
			await uploadStream.abort();
		} catch {
			// ignore
		}
		if (rejectFn) {
			rejectFn(reason);
		}
	};

	return { promise: uploadPromise, abort };
};

export const deleteSourceVideo = async (fileId) => {
	if (!fileId) {
		return;
	}
	const bucket = ensureBucket();
	const normalizedId = typeof fileId === "string" ? new ObjectId(fileId) : fileId;
	await bucket.delete(normalizedId);
};

export const createSourceVideoReadStream = (fileId) => {
	if (!fileId) {
		throw new Error("fileId is required to create a read stream.");
	}
	const bucket = ensureBucket();
	const normalizedId = typeof fileId === "string" ? new ObjectId(fileId) : fileId;
	return bucket.openDownloadStream(normalizedId);
};

export const materializeSourceVideoToFile = async (fileId, { ensureDir } = {}) => {
	const readStream = createSourceVideoReadStream(fileId);

	let targetDir = ensureDir;
	if (!targetDir) {
		targetDir = await mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
	} else {
		await mkdir(targetDir, { recursive: true });
	}

	const filename = `${crypto.randomUUID()}.mp4`;
	const filePath = path.join(targetDir, filename);
	const writeStream = createWriteStream(filePath);

	await pipeline(readStream, writeStream);

	return filePath;
};



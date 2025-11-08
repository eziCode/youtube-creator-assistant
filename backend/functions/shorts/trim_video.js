import { execFile } from "child_process";
import { mkdir } from "fs/promises";
import crypto from "crypto";
import path from "path";

const DEFAULT_OUTPUT_DIR = "./downloads";

let ffmpegCommandCache;

const execFileAsync = (command, args) =>
	new Promise((resolve, reject) => {
		execFile(command, args, (error, stdout, stderr) => {
			if (error) {
				const enrichedError = new Error(
					`Failed to execute ${command}: ${stderr || error.message || "Unknown error"}`
				);
				enrichedError.cause = error;
				return reject(enrichedError);
			}
			resolve({ stdout, stderr });
		});
	});

const resolveFfmpegCommand = async () => {
	if (ffmpegCommandCache) {
		return ffmpegCommandCache;
	}

	if (process.env.FFMPEG_PATH) {
		ffmpegCommandCache = process.env.FFMPEG_PATH;
		return ffmpegCommandCache;
	}

	try {
		const ffmpegModule = await import("@ffmpeg-installer/ffmpeg");
		const installerPath = ffmpegModule?.path ?? ffmpegModule?.default?.path;

		if (installerPath) {
			ffmpegCommandCache = installerPath;
			return ffmpegCommandCache;
		}
	} catch (error) {
		if (error?.code !== "MODULE_NOT_FOUND") {
			console.warn("Failed to load @ffmpeg-installer/ffmpeg. Falling back to system ffmpeg.", error);
		}
	}

	ffmpegCommandCache = "ffmpeg";
	return ffmpegCommandCache;
};

const formatTimestamp = (seconds) => {
	const value = Number(seconds);
	if (!Number.isFinite(value) || value < 0) {
		throw new Error("Timestamps must be finite non-negative numbers.");
	}

	const totalMilliseconds = Math.round(value * 1000);
	const hours = Math.floor(totalMilliseconds / 3_600_000);
	const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
	const secs = Math.floor((totalMilliseconds % 60_000) / 1_000);
	const milliseconds = totalMilliseconds % 1_000;

	const hoursStr = String(hours).padStart(2, "0");
	const minutesStr = String(minutes).padStart(2, "0");
	const secondsStr = String(secs).padStart(2, "0");
	const millisStr = milliseconds ? `.${String(milliseconds).padStart(3, "0").replace(/0+$/, "")}` : "";

	return `${hoursStr}:${minutesStr}:${secondsStr}${millisStr}`;
};

const resolveClipWindow = (segment) => {
	if (Array.isArray(segment) && segment.length >= 2) {
		return [Number(segment[0]), Number(segment[1])];
	}

	if (segment && typeof segment === "object") {
		const start = segment.start ?? segment.startTime ?? segment[0];
		const end = segment.end ?? segment.endTime ?? segment[1];
		return [Number(start), Number(end)];
	}

	throw new Error("Each segment must be a tuple [start, end] or an object with start/end properties.");
};

export async function trimVideo(inputPath, segments, { outputDir = DEFAULT_OUTPUT_DIR, overwrite = true } = {}) {
	if (typeof inputPath !== "string" || !inputPath.trim()) {
		throw new Error("A valid inputPath string is required.");
	}

	if (!Array.isArray(segments) || segments.length === 0) {
		throw new Error("segments must be a non-empty array of [start, end] tuples.");
	}

	const resolvedInputPath = path.resolve(inputPath);
	const resolvedOutputDir = path.resolve(outputDir ?? DEFAULT_OUTPUT_DIR);

	await mkdir(resolvedOutputDir, { recursive: true });

	const { name: baseName, ext } = path.parse(resolvedInputPath);
	const extension = ext || ".mp4";

	const clips = [];

	const ffmpegCommand = await resolveFfmpegCommand();

	for (let index = 0; index < segments.length; index += 1) {
		const segment = segments[index];
		const [rawStart, rawEnd] = resolveClipWindow(segment);

		if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
			throw new Error(`Segment at index ${index} contains non-numeric timestamps.`);
		}

		if (rawStart < 0 || rawEnd <= rawStart) {
			throw new Error(`Segment at index ${index} must have start >= 0 and end > start.`);
		}

		const durationSeconds = rawEnd - rawStart;

		const startTimestamp = formatTimestamp(rawStart);
		const durationTimestamp = formatTimestamp(durationSeconds);

		const clipId = crypto.randomUUID().slice(0, 8);
		const filename = `${baseName}_clip_${index + 1}_${clipId}${extension}`;
		const outputPath = path.join(resolvedOutputDir, filename);

		const args = overwrite ? ["-y"] : ["-n"];

		if (rawStart > 0) {
			args.push("-ss", startTimestamp);
		}

		args.push("-i", resolvedInputPath, "-t", durationTimestamp, "-c", "copy", outputPath);

		try {
			await execFileAsync(ffmpegCommand, args);
		} catch (error) {
			throw new Error(`FFmpeg failed while creating clip ${index + 1}: ${error.message}`);
		}

		clips.push(outputPath);
	}

	return clips;
}
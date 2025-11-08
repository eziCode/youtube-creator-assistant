import { google } from "googleapis";
import { buildOAuthClient } from "../../utils/googleOAuthClient.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (date) => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		throw new Error("Invalid date provided to formatDate");
	}
	return date.toISOString().slice(0, 10);
};

const parseAggregateRow = (response) => {
	const headers = response?.columnHeaders ?? [];
	const row = response?.rows?.[0] ?? [];
	return headers.reduce((acc, header, index) => {
		if (header?.columnType === "METRIC") {
			acc[header.name] = Number(row[index] ?? 0);
		}
		return acc;
	}, {});
};

const parseTimeseriesRows = (response) => {
	const headers = response?.columnHeaders ?? [];
	const rows = response?.rows ?? [];
	return rows.map((row) => {
		return headers.reduce((acc, header, index) => {
			if (header?.columnType === "DIMENSION" && header.name === "day") {
				acc.date = row[index];
			} else if (header?.columnType === "METRIC") {
				acc[header.name] = Number(row[index] ?? 0);
			}
			return acc;
		}, {});
	});
};

const parseVideoRows = (response) => {
	const headers = response?.columnHeaders ?? [];
	const rows = response?.rows ?? [];
	return rows.map((row) => {
		return headers.reduce((acc, header, index) => {
			if (header?.columnType === "DIMENSION" && header.name === "video") {
				acc.videoId = row[index];
			} else if (header?.columnType === "METRIC") {
				acc[header.name] = Number(row[index] ?? 0);
			}
			return acc;
		}, {});
	});
};

const calculateDelta = (currentValue, previousValue) => {
	const safeCurrent = Number.isFinite(currentValue) ? currentValue : 0;
	const safePrevious = Number.isFinite(previousValue) ? previousValue : 0;
	const delta = safeCurrent - safePrevious;
	const ratio =
		safePrevious === 0
			? safeCurrent === 0
				? null
				: 1
			: delta / safePrevious;
	return {
		value: safeCurrent,
		delta,
		deltaRatio: Number.isFinite(ratio) ? ratio : null,
	};
};

const buildMetricsPayload = (current, previous) => {
	const totals = {};
	const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);

	for (const key of keys) {
		totals[key] = calculateDelta(current[key], previous[key]);
	}

	if (!totals.netSubscribers) {
		const currentNet =
			(current.subscribersGained ?? 0) - (current.subscribersLost ?? 0);
		const previousNet =
			(previous.subscribersGained ?? 0) - (previous.subscribersLost ?? 0);
		totals.netSubscribers = calculateDelta(currentNet, previousNet);
	}

	return totals;
};

const defaultDateRanges = () => {
	const currentPeriodEnd = new Date(Date.now() - DAY_MS);
	const currentPeriodStart = new Date(
		currentPeriodEnd.getTime() - 27 * DAY_MS
	);
	const previousPeriodEnd = new Date(currentPeriodStart.getTime() - DAY_MS);
	const previousPeriodStart = new Date(
		previousPeriodEnd.getTime() - 27 * DAY_MS
	);

	return {
		current: {
			startDate: formatDate(currentPeriodStart),
			endDate: formatDate(currentPeriodEnd),
		},
		previous: {
			startDate: formatDate(previousPeriodStart),
			endDate: formatDate(previousPeriodEnd),
		},
	};
};

const getChannelAnalyticsOverview = async ({ channelId, tokens, dateRange }) => {
	if (!channelId) {
		throw new Error("channelId is required to retrieve analytics");
	}

	const { current, previous } = dateRange ?? defaultDateRanges();

	const oauth2Client = buildOAuthClient(tokens);
	const youtubeAnalytics = google.youtubeAnalytics({
		version: "v2",
		auth: oauth2Client,
	});

	const metrics =
		"views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost";

	const ids = `channel==${channelId}`;

	const [currentAggregate, previousAggregate, daily, topVideos] =
		await Promise.all([
			youtubeAnalytics.reports.query({
				ids,
				startDate: current.startDate,
				endDate: current.endDate,
				metrics,
			}),
			youtubeAnalytics.reports.query({
				ids,
				startDate: previous.startDate,
				endDate: previous.endDate,
				metrics,
			}),
			youtubeAnalytics.reports.query({
				ids,
				startDate: current.startDate,
				endDate: current.endDate,
				metrics,
				dimensions: "day",
				sort: "day",
			}),
			youtubeAnalytics.reports.query({
				ids,
				startDate: current.startDate,
				endDate: current.endDate,
				metrics:
					"views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
				dimensions: "video",
				sort: "-views",
				maxResults: 5,
			}),
		]);

	const aggregateCurrent = parseAggregateRow(currentAggregate.data);
	const aggregatePrevious = parseAggregateRow(previousAggregate.data);
	const totals = buildMetricsPayload(aggregateCurrent, aggregatePrevious);

	const dailyRows = parseTimeseriesRows(daily.data);
	const topVideoRows = parseVideoRows(topVideos.data);

	const credentials = oauth2Client.credentials ?? {};
	const updatedTokens = {
		accessToken: credentials.access_token ?? tokens?.accessToken ?? null,
		refreshToken: credentials.refresh_token ?? tokens?.refreshToken ?? null,
		scope: credentials.scope ?? tokens?.scope ?? null,
		tokenType: credentials.token_type ?? tokens?.tokenType ?? null,
		expiryDate: credentials.expiry_date ?? tokens?.expiryDate ?? null,
	};

	return {
		analytics: {
			period: { current, previous },
			totals,
			daily: dailyRows,
			topVideos: topVideoRows,
		},
		updatedTokens,
	};
};

const getVideoAnalyticsOverview = async ({
	channelId,
	videoId,
	tokens,
	dateRange,
}) => {
	if (!channelId) {
		throw new Error("channelId is required to retrieve video analytics");
	}

	if (!videoId) {
		throw new Error("videoId is required to retrieve video analytics");
	}

	const { current, previous } = dateRange ?? defaultDateRanges();

	const oauth2Client = buildOAuthClient(tokens);
	const youtubeAnalytics = google.youtubeAnalytics({
		version: "v2",
		auth: oauth2Client,
	});

	const metrics =
		"views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost";

	const ids = `channel==${channelId}`;
	const filters = `video==${videoId}`;

	const [currentAggregate, previousAggregate, daily] = await Promise.all([
		youtubeAnalytics.reports.query({
			ids,
			filters,
			startDate: current.startDate,
			endDate: current.endDate,
			metrics,
		}),
		youtubeAnalytics.reports.query({
			ids,
			filters,
			startDate: previous.startDate,
			endDate: previous.endDate,
			metrics,
		}),
		youtubeAnalytics.reports.query({
			ids,
			filters,
			startDate: current.startDate,
			endDate: current.endDate,
			metrics,
			dimensions: "day",
			sort: "day",
		}),
	]);

	const aggregateCurrent = parseAggregateRow(currentAggregate.data);
	const aggregatePrevious = parseAggregateRow(previousAggregate.data);
	const totals = buildMetricsPayload(aggregateCurrent, aggregatePrevious);

	const dailyRows = parseTimeseriesRows(daily.data);

	const credentials = oauth2Client.credentials ?? {};
	const updatedTokens = {
		accessToken: credentials.access_token ?? tokens?.accessToken ?? null,
		refreshToken: credentials.refresh_token ?? tokens?.refreshToken ?? null,
		scope: credentials.scope ?? tokens?.scope ?? null,
		tokenType: credentials.token_type ?? tokens?.tokenType ?? null,
		expiryDate: credentials.expiry_date ?? tokens?.expiryDate ?? null,
	};

	return {
		analytics: {
			videoId,
			period: { current, previous },
			totals,
			daily: dailyRows,
			topVideos: [],
		},
		updatedTokens,
	};
};

export { getChannelAnalyticsOverview, getVideoAnalyticsOverview };


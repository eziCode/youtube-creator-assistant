const DAY_MS = 24 * 60 * 60 * 1000;

const clampNumber = (value, min, max) => {
	const number = Number(value);
	if (!Number.isFinite(number)) return min;
	return Math.min(Math.max(number, min), max);
};

const createRandomGenerator = (seedInput) => {
	let state = 0;
	const seed =
		typeof seedInput === "number"
			? seedInput
			: seedInput
			? Array.from(String(seedInput)).reduce((acc, char, index) => {
					return acc + char.charCodeAt(0) * (index + 1);
				}, 0)
			: 123456;

	return () => {
		state += 1;
		const x = Math.sin(seed + state) * 10000;
		return x - Math.floor(x);
	};
};

const buildPeriod = (rangeDays) => {
	const clamped = clampNumber(rangeDays, 1, 180);
	const endDate = new Date(Date.now() - DAY_MS);
	endDate.setUTCHours(0, 0, 0, 0);
	const startDate = new Date(endDate.getTime() - (clamped - 1) * DAY_MS);

	const previousEnd = new Date(startDate.getTime() - DAY_MS);
	const previousStart = new Date(previousEnd.getTime() - (clamped - 1) * DAY_MS);

	const formatDate = (date) => date.toISOString().slice(0, 10);

	return {
		current: {
			startDate: formatDate(startDate),
			endDate: formatDate(endDate),
		},
		previous: {
			startDate: formatDate(previousStart),
			endDate: formatDate(previousEnd),
		},
	};
};

const rollUpDailyTotals = (dailyEntries) => {
	const totals = {
		views: 0,
		estimatedMinutesWatched: 0,
		averageViewDuration: 0,
		averageViewPercentage: 0,
		likes: 0,
		comments: 0,
		shares: 0,
		subscribersGained: 0,
		subscribersLost: 0,
	};

	dailyEntries.forEach((entry) => {
		totals.views += entry.views ?? 0;
		totals.estimatedMinutesWatched += entry.estimatedMinutesWatched ?? 0;
		totals.averageViewDuration += entry.averageViewDuration ?? 0;
		totals.averageViewPercentage += entry.averageViewPercentage ?? 0;
		totals.likes += entry.likes ?? 0;
		totals.comments += entry.comments ?? 0;
		totals.shares += entry.shares ?? 0;
		totals.subscribersGained += entry.subscribersGained ?? 0;
		totals.subscribersLost += entry.subscribersLost ?? 0;
	});

	const days = dailyEntries.length || 1;
	const averageViewDuration = totals.averageViewDuration / days;
	const averageViewPercentage = totals.averageViewPercentage / days;

	return {
		views: totals.views,
		estimatedMinutesWatched: totals.estimatedMinutesWatched,
		averageViewDuration,
		averageViewPercentage,
		likes: totals.likes,
		comments: totals.comments,
		shares: totals.shares,
		subscribersGained: totals.subscribersGained,
		subscribersLost: totals.subscribersLost,
	};
};

const buildDelta = (currentValue, previousValue) => {
	const safeCurrent = Number.isFinite(currentValue) ? currentValue : 0;
	const safePrevious = Number.isFinite(previousValue) ? previousValue : 0;
	const delta = safeCurrent - safePrevious;
	const ratio = safePrevious === 0 ? (safeCurrent === 0 ? null : 1) : delta / safePrevious;
	return {
		value: Math.round(safeCurrent),
		delta: Math.round(delta),
		deltaRatio: Number.isFinite(ratio) ? ratio : null,
	};
};

const deriveTotalsWithDeltas = (currentTotals, previousTotals) => {
	const keys = new Set([
		...Object.keys(currentTotals ?? {}),
		...Object.keys(previousTotals ?? {}),
	]);

	const totals = {};
	for (const key of keys) {
		const currentValue = currentTotals?.[key] ?? 0;
		const previousValue = previousTotals?.[key] ?? 0;
		totals[key] = buildDelta(currentValue, previousValue);
	}

	const currentNet =
		(currentTotals?.subscribersGained ?? 0) - (currentTotals?.subscribersLost ?? 0);
	const previousNet =
		(previousTotals?.subscribersGained ?? 0) - (previousTotals?.subscribersLost ?? 0);
	totals.netSubscribers = buildDelta(currentNet, previousNet);

	return totals;
};

const generateDailySeries = ({
	rangeDays,
	baseViews,
	baseWatchMinutes,
	random,
}) => {
	const clamped = clampNumber(rangeDays, 1, 180);
	const series = [];

	for (let index = clamped - 1; index >= 0; index -= 1) {
		const date = new Date(Date.now() - DAY_MS * (index + 1));
		date.setUTCHours(0, 0, 0, 0);

		const trendFactor = 0.85 + random() * 0.3;
		const weekendBoost = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 1.15 : 1;

		const views = Math.round(baseViews * trendFactor * weekendBoost);
		const minutesWatched = Math.round(baseWatchMinutes * trendFactor * weekendBoost);
		const averageViewDurationSeconds = clampNumber(
			(minutesWatched / Math.max(views, 1)) * 60,
			90,
			1800,
		);
		const averageViewPercentage = clampNumber(43 + random() * 25, 35, 95);

		const likes = Math.round(views * (0.018 + random() * 0.006));
		const comments = Math.round(views * (0.003 + random() * 0.002));
		const shares = Math.round(views * (0.0015 + random() * 0.001));

		const subscribersGained = Math.round(views * (0.0008 + random() * 0.0004));
		const subscribersLost = Math.round(subscribersGained * (0.12 + random() * 0.08));

		series.push({
			date: date.toISOString().slice(0, 10),
			views,
			estimatedMinutesWatched: minutesWatched,
			averageViewDuration: averageViewDurationSeconds,
			averageViewPercentage,
			likes,
			comments,
			shares,
			subscribersGained,
			subscribersLost,
		});
	}

	return series;
};

const generateDemoChannelAnalytics = ({
	channelProfile,
	videoSummaries = [],
	rangeDays = 28,
}) => {
	const period = buildPeriod(rangeDays);
	const random = createRandomGenerator(channelProfile?.id);

	const publicViews = Number(channelProfile?.viewCount ?? 0);
	const publicSubscribers = Number(channelProfile?.subscriberCount ?? 0);

	const currentViews = Math.max(500000, Math.round(publicViews * 0.0018));
	const previousViews = Math.round(currentViews * (0.84 + random() * 0.24));

	const averageMinutesPerView = 11 + random() * 5;
	const currentWatchMinutes = Math.round(currentViews * averageMinutesPerView);
	const previousWatchMinutes = Math.round(previousViews * (averageMinutesPerView * (0.96 + random() * 0.08)));

	const dailySeries = generateDailySeries({
		rangeDays,
		baseViews: Math.round(currentViews / rangeDays),
		baseWatchMinutes: Math.round(currentWatchMinutes / rangeDays),
		random,
	});

	const currentTotals = rollUpDailyTotals(dailySeries);
	const previousTotals = {
		views: previousViews,
		estimatedMinutesWatched: previousWatchMinutes,
		averageViewDuration: currentTotals.averageViewDuration * (0.96 + random() * 0.08),
		averageViewPercentage: currentTotals.averageViewPercentage * (0.95 + random() * 0.05),
		likes: Math.round(previousViews * (currentTotals.likes / Math.max(currentTotals.views, 1))),
		comments: Math.round(previousViews * (currentTotals.comments / Math.max(currentTotals.views, 1))),
		shares: Math.round(previousViews * (currentTotals.shares / Math.max(currentTotals.views, 1))),
		subscribersGained: Math.round(previousViews * (currentTotals.subscribersGained / Math.max(currentTotals.views, 1))),
		subscribersLost: Math.round(previousViews * (currentTotals.subscribersLost / Math.max(currentTotals.views, 1))),
	};

	const totalsWithDelta = deriveTotalsWithDeltas(currentTotals, previousTotals);

	const sortedTopVideos = [...videoSummaries]
		.filter((video) => Number.isFinite(video?.viewCount))
		.sort((a, b) => (Number(b.viewCount ?? 0) || 0) - (Number(a.viewCount ?? 0) || 0))
		.slice(0, 5)
		.map((video) => {
			const views = Number(video.viewCount ?? 0);
			const minutesWatched = Math.round(
				views * (averageMinutesPerView * (0.8 + random() * 0.6)),
			);
			return {
				videoId: video.id,
				title: video.title,
				views,
				estimatedMinutesWatched: minutesWatched,
				averageViewDuration: clampNumber(
					(minutesWatched / Math.max(views, 1)) * 60,
					90,
					1800,
				),
				averageViewPercentage: clampNumber(45 + random() * 30, 38, 98),
				likes: Math.round(views * (0.02 + random() * 0.01)),
				comments: Math.round(views * (0.004 + random() * 0.002)),
				shares: Math.round(views * (0.002 + random() * 0.001)),
				subscribersGained: Math.round(views * (0.0009 + random() * 0.0005)),
				subscribersLost: Math.round(views * (0.00015 + random() * 0.0001)),
			};
		});

	return {
		period,
		totals: totalsWithDelta,
		daily: dailySeries,
		topVideos: sortedTopVideos,
		subscribers: {
			totalSubscribers: publicSubscribers || null,
			isEstimate: true,
		},
	};
};

const generateDemoVideoAnalytics = ({ videoSummary, rangeDays = 28 }) => {
	if (!videoSummary) {
		throw new Error("videoSummary is required to build demo analytics.");
	}

	const period = buildPeriod(rangeDays);
	const random = createRandomGenerator(`${videoSummary.id}-${rangeDays}`);

	const totalViews = Number(videoSummary.viewCount ?? 0);
	const currentViews = Math.max(5000, Math.round(totalViews * (0.18 + random() * 0.22)));
	const previousViews = Math.round(currentViews * (0.78 + random() * 0.25));

	const averageMinutesPerView = 9 + random() * 4;
	const currentWatchMinutes = Math.round(currentViews * averageMinutesPerView);
	const previousWatchMinutes = Math.round(previousViews * (averageMinutesPerView * (0.94 + random() * 0.1)));

	const dailySeries = generateDailySeries({
		rangeDays,
		baseViews: Math.round(currentViews / rangeDays),
		baseWatchMinutes: Math.round(currentWatchMinutes / rangeDays),
		random,
	});

	const currentTotals = rollUpDailyTotals(dailySeries);
	const previousTotals = {
		views: previousViews,
		estimatedMinutesWatched: previousWatchMinutes,
		averageViewDuration: currentTotals.averageViewDuration * (0.95 + random() * 0.07),
		averageViewPercentage: currentTotals.averageViewPercentage * (0.94 + random() * 0.04),
		likes: Math.round(previousViews * (currentTotals.likes / Math.max(currentTotals.views, 1))),
		comments: Math.round(previousViews * (currentTotals.comments / Math.max(currentTotals.views, 1))),
		shares: Math.round(previousViews * (currentTotals.shares / Math.max(currentTotals.views, 1))),
		subscribersGained: Math.round(previousViews * (currentTotals.subscribersGained / Math.max(currentTotals.views, 1))),
		subscribersLost: Math.round(previousViews * (currentTotals.subscribersLost / Math.max(currentTotals.views, 1))),
	};

	const totalsWithDelta = deriveTotalsWithDeltas(currentTotals, previousTotals);

	return {
		videoId: videoSummary.id,
		period,
		totals: totalsWithDelta,
		daily: dailySeries,
		topVideos: [],
	};
};

export { generateDemoChannelAnalytics, generateDemoVideoAnalytics };



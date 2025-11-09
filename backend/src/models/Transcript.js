import mongoose from "mongoose";

const transcriptEntrySchema = new mongoose.Schema(
	{
		startTime: { type: Number, required: true },
		duration: { type: Number, required: true },
		text: { type: String, required: true },
	},
	{ _id: false }
);

const transcriptSchema = new mongoose.Schema(
	{
		videoId: { type: String, required: true, unique: true, index: true },
		transcript: {
			type: [transcriptEntrySchema],
			default: [],
		},
		videoDurationSeconds: { type: Number },
		language: { type: String },
		captionTrackId: { type: String },
		lastFetchedAt: { type: Date, default: Date.now },
	},
	{
		timestamps: true,
	}
);

transcriptSchema.pre("save", function updateLastFetched(next) {
	this.lastFetchedAt = new Date();
	next();
});

const Transcript =
	mongoose.models.Transcript || mongoose.model("Transcript", transcriptSchema);

export default Transcript;



import mongoose from "mongoose";

const cachedVideoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    publishedAt: { type: Date },
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const channelVideosCacheSchema = new mongoose.Schema(
  {
    channelId: { type: String, required: true, unique: true },
    fetchedAt: { type: Date, required: true, default: Date.now },
    videos: { type: [cachedVideoSchema], default: [] },
  },
  {
    collection: "channel_videos_cache",
    timestamps: true,
  }
);

channelVideosCacheSchema.index({ channelId: 1 }, { unique: true });
channelVideosCacheSchema.index({ fetchedAt: 1 });

const ChannelVideosCache =
  mongoose.models.ChannelVideosCache ||
  mongoose.model("ChannelVideosCache", channelVideosCacheSchema);

export default ChannelVideosCache;


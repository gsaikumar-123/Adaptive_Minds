import mongoose from "mongoose";

const WeakTopicSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true },
    topic: { type: String, required: true },
    reason: { type: String, required: true }
  },
  { timestamps: true }
);

export const WeakTopic = mongoose.model("WeakTopic", WeakTopicSchema);

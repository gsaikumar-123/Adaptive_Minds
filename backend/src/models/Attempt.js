import mongoose from "mongoose";

const AttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    domain: { type: String, required: true },
    goal: { type: String, required: true },
    intentSummary: { type: String, required: true },
    modulesToTest: { type: [String], default: [] },
    assessedDepth: { type: Number, default: 0 },
    learnerLevel: { type: String, default: "intermediate" },
    assessmentTopics: { type: [String], default: [] },
    maxQuestions: { type: Number, default: 12 },
    minQuestions: { type: Number, default: 8 },
    adaptiveRound: { type: Number, default: 1 },
    includeFullRoadmap: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
    roadmapId: { type: mongoose.Schema.Types.ObjectId, ref: "GeneratedRoadmap" }
  },
  { timestamps: true }
);

AttemptSchema.index({ userId: 1, createdAt: -1 });
AttemptSchema.index({ domain: 1 });

export const Attempt = mongoose.model("Attempt", AttemptSchema);

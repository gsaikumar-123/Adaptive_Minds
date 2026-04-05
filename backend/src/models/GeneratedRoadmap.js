import mongoose from "mongoose";

const GeneratedRoadmapSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true },
    csv: { type: String, required: true },
    modules: { type: [String], default: [] },
    forecastSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const GeneratedRoadmap = mongoose.model("GeneratedRoadmap", GeneratedRoadmapSchema);

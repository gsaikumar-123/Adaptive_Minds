import mongoose from "mongoose";

const ProgressSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        topic: { type: String, required: true },
        domain: { type: String, required: true },
        completedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

// Ensure a user can only complete a specific topic in a domain once
ProgressSchema.index({ userId: 1, topic: 1, domain: 1 }, { unique: true });

export const Progress = mongoose.model("Progress", ProgressSchema);

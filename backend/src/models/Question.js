import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true },
    prompt: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true },
    explanation: { type: String, required: true },
    tags: { type: [String], default: [] },
    modules: { type: [String], default: [] },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true }
  },
  { timestamps: true }
);

QuestionSchema.index({ attemptId: 1 });

export const Question = mongoose.model("Question", QuestionSchema);

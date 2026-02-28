import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    selectedIndex: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true }
  },
  { timestamps: true }
);

AnswerSchema.index({ attemptId: 1 });

export const Answer = mongoose.model("Answer", AnswerSchema);

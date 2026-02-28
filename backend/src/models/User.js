import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    promptUsage: {
      count: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);

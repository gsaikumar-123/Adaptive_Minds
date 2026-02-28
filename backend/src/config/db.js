import mongoose from "mongoose";

export const connectDb = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }
  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB || "adaptive_roadmap"
  });
  console.log("MongoDB connected");
};

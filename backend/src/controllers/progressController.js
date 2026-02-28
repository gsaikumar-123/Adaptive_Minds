import mongoose from "mongoose";
import { Progress } from "../models/Progress.js";

export const completeTopic = async (req, res, next) => {
    try {
        // Requires authentication middleware to attach req.user
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { topic, domain } = req.body;
        if (!topic || !domain) {
            return res.status(400).json({ error: "Topic and domain are required" });
        }

        const newProgress = await Progress.findOneAndUpdate(
            { userId: req.user.id, topic, domain },
            { completedAt: new Date() },
            { upsert: true, new: true }
        );

        res.json({ message: "Topic marked as complete", progress: newProgress });
    } catch (error) {
        next(error);
    }
};

export const uncompleteTopic = async (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { topic, domain } = req.body;
        if (!topic || !domain) {
            return res.status(400).json({ error: "Topic and domain are required" });
        }

        await Progress.findOneAndDelete({ userId: req.user.id, topic, domain });

        res.json({ message: "Topic unmarked" });
    } catch (error) {
        next(error);
    }
};

export const getCompletedTopics = async (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { domain } = req.query;
        if (!domain) {
            return res.status(400).json({ error: "Domain query parameter required" });
        }

        const progressRecords = await Progress.find({ userId: req.user.id, domain });
        const completedTopics = progressRecords.map((p) => p.topic);

        res.json({ completedTopics });
    } catch (error) {
        next(error);
    }
};

// Get heatmap data (count of completed topics per day)
export const getHeatmapData = async (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        // req.user.id is a string from JWT; convert to ObjectId for aggregation $match
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const heatmap = await Progress.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: {
                        // Group by YYYY-MM-DD
                        $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: "$_id",
                    count: 1
                }
            },
            { $sort: { date: 1 } }
        ]);

        res.json(heatmap);
    } catch (error) {
        next(error);
    }
};

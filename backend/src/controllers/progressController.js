import mongoose from "mongoose";
import { Progress } from "../models/Progress.js";
import { Attempt } from "../models/Attempt.js";
import { Answer } from "../models/Answer.js";
import { Question } from "../models/Question.js";
import { getRoadmapById } from "../services/roadmapLoader.js";
import { buildLearningForecast } from "../services/learningForecastEngine.js";
import { fetchDktForecast } from "../services/mlForecastClient.js";

const normalize = (text) => (typeof text === "string" ? text.trim().toLowerCase() : "");

const buildForecastComparison = (baseline, advanced) => {
    const baselineReadiness = baseline?.summary?.readinessScore ?? 0;
    const advancedReadiness = advanced?.summary?.readinessScore ?? baselineReadiness;

    const baselinePriority = (baseline?.recommendations?.priorityNow || []).slice(0, 8);
    const advancedPriority = (advanced?.recommendations?.priorityNow || []).slice(0, 8);

    const baselineSet = new Set(
        baselinePriority.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`)
    );
    const advancedSet = new Set(
        advancedPriority.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`)
    );

    const overlap = Array.from(advancedSet).filter((key) => baselineSet.has(key)).length;
    const overlapRate = advancedSet.size ? Math.round((overlap / advancedSet.size) * 100) : 0;

    return {
        readinessDelta: advancedReadiness - baselineReadiness,
        priorityOverlapRate: overlapRate,
        baselineTopK: baselinePriority.length,
        advancedTopK: advancedPriority.length,
    };
};

const collectForecastEvidence = async ({ userId, domain }) => {
    const attempts = await Attempt.find({
        userId,
        domain,
        status: "completed",
    })
        .select("_id")
        .lean();

    const attemptIds = attempts.map((attempt) => attempt._id);
    let questionEvents = [];

    if (attemptIds.length > 0) {
        const answers = await Answer.find({ attemptId: { $in: attemptIds } })
            .select("questionId isCorrect createdAt")
            .lean();

        const questionIds = Array.from(new Set(answers.map((answer) => answer.questionId.toString())));
        const questions = await Question.find({ _id: { $in: questionIds } })
            .select("_id modules tags difficulty")
            .lean();

        const questionMap = new Map(questions.map((question) => [question._id.toString(), question]));

        questionEvents = answers
            .map((answer) => {
                const question = questionMap.get(answer.questionId.toString());
                if (!question) return null;

                return {
                    isCorrect: !!answer.isCorrect,
                    difficulty: question.difficulty || "medium",
                    modules: question.modules || [],
                    tags: question.tags || [],
                    createdAt: answer.createdAt,
                };
            })
            .filter(Boolean);
    }

    const progressRecords = await Progress.find({ userId, domain })
        .select("topic")
        .lean();

    const completedTopics = progressRecords.map((record) => record.topic);

    return {
        questionEvents,
        completedTopics,
    };
};

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

export const getLearningForecast = async (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { domain } = req.query;
        if (!domain) {
            return res.status(400).json({ error: "Domain query parameter required" });
        }

        const roadmap = getRoadmapById(domain);
        if (!roadmap) {
            return res.status(404).json({ error: "Domain not found" });
        }

        const { questionEvents, completedTopics } = await collectForecastEvidence({
            userId: req.user.id,
            domain,
        });

        const forecast = buildLearningForecast({
            roadmapModules: roadmap.modules,
            questionEvents,
            completedTopics,
            seedKey: `${req.user.id}:${domain}:${new Date().toISOString().slice(0, 10)}`,
        });

        res.json({
            domain,
            forecast,
        });
    } catch (error) {
        next(error);
    }
};

export const getLearningForecastV2 = async (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });

        const { domain } = req.query;
        if (!domain) {
            return res.status(400).json({ error: "Domain query parameter required" });
        }

        const roadmap = getRoadmapById(domain);
        if (!roadmap) {
            return res.status(404).json({ error: "Domain not found" });
        }

        const { questionEvents, completedTopics } = await collectForecastEvidence({
            userId: req.user.id,
            domain,
        });

        const seedKey = `${req.user.id}:${domain}:${new Date().toISOString().slice(0, 10)}`;

        const baselineForecast = buildLearningForecast({
            roadmapModules: roadmap.modules,
            questionEvents,
            completedTopics,
            seedKey,
        });

        let dktForecast = null;
        let source = "baseline-only";
        let warning = null;

        try {
            dktForecast = await fetchDktForecast({
                learnerId: req.user.id,
                domain,
                roadmapModules: roadmap.modules,
                questionEvents,
                completedTopics,
                seedKey,
            });

            if (dktForecast) {
                source = "dkt-service";
            }
        } catch (serviceError) {
            warning = "Advanced ML service unavailable. Returned baseline forecast.";
            console.error("Forecast-v2 fallback to baseline:", serviceError.message);
        }

        const effectiveAdvanced = dktForecast || baselineForecast;

        res.json({
            domain,
            source,
            warning,
            baselineForecast,
            dktForecast,
            effectiveForecast: effectiveAdvanced,
            comparison: buildForecastComparison(baselineForecast, effectiveAdvanced),
        });
    } catch (error) {
        next(error);
    }
};

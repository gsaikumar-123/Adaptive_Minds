import { z } from "zod";
import mongoose from "mongoose";
import { getRoadmapById } from "../services/roadmapLoader.js";
import { analyzeIntent } from "../services/assessmentEngine.js";
import { generateMcqs } from "../services/mcqGenerator.js";
import { evaluateResults } from "../services/evaluationEngine.js";
import { generateAdaptiveRoadmap } from "../services/adaptiveRoadmap.js";
import { Attempt } from "../models/Attempt.js";
import { Question } from "../models/Question.js";
import { Answer } from "../models/Answer.js";
import { WeakTopic } from "../models/WeakTopic.js";
import { GeneratedRoadmap } from "../models/GeneratedRoadmap.js";
import { User } from "../models/User.js";

const startSchema = z.object({
  domainId: z.string().min(1),
  goal: z.string().min(5).max(1000),
});

const submitSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      selectedIndex: z.number().int().min(0).max(3),
    })
  ),
});

const unique = (items) => Array.from(new Set(items));

/**
 * Helper: get IST date string for daily prompt limit comparisons.
 */
const getISTDateString = (dateObj) => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    dateObj
  );
};

/**
 * Atomically check and increment the daily prompt limit using findOneAndUpdate.
 * Returns { allowed, user } where allowed=false means limit exceeded.
 */
const checkAndIncrementPromptLimit = async (userId) => {
  const todayIST = getISTDateString(new Date());

  // First try to increment if same day and under limit
  let user = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $and: [
          {
            $eq: [
              {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$promptUsage.lastReset",
                  timezone: "Asia/Kolkata",
                },
              },
              todayIST,
            ],
          },
          { $lt: ["$promptUsage.count", 3] },
        ],
      },
    },
    { $inc: { "promptUsage.count": 1 } },
    { new: true }
  );

  if (user) {
    return { allowed: true, user };
  }

  // Either different day or limit hit. Check which case:
  user = await User.findById(userId);
  if (!user) return { allowed: false, user: null };

  const lastResetIST = user.promptUsage?.lastReset
    ? getISTDateString(new Date(user.promptUsage.lastReset))
    : "1970-01-01";

  if (todayIST !== lastResetIST) {
    // New day - reset and set count to 1 atomically
    user = await User.findOneAndUpdate(
      { _id: userId },
      { $set: { "promptUsage.count": 1, "promptUsage.lastReset": new Date() } },
      { new: true }
    );
    return { allowed: true, user };
  }

  // Same day, limit exceeded
  return { allowed: false, user };
};

export const startAssessment = async (req, res, next) => {
  try {
    const { domainId, goal } = startSchema.parse(req.body);
    const roadmap = getRoadmapById(domainId);
    if (!roadmap) {
      return res.status(404).json({ error: "Domain not found" });
    }

    // Atomic prompt limit check
    const { allowed, user } = await checkAndIncrementPromptLimit(req.user.id);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!allowed) {
      return res.status(429).json({
        error: "Daily prompt limit reached (Max 3/day). Please try again tomorrow.",
      });
    }

    const intent = await analyzeIntent({ domainId, goal, roadmap });
    const assessmentTopics = unique(intent.assessmentTopics || []).slice(0, 30);
    const targetModules = unique(intent.targetModules || []);
    const learnerLevel = intent.learnerLevel || "intermediate";
    const includeFullRoadmap = intent.includeFullRoadmap || false;
    const questionCount =
      intent.recommendedQuestionCount ||
      Math.min(30, assessmentTopics.length || 15);

    const mcqPayload = await generateMcqs({
      domainId,
      goal,
      assessmentTopics,
      roadmapModules: roadmap.modules,
      maxQuestions: questionCount,
      learnerLevel,
    });

    const attempt = await Attempt.create({
      userId: user._id,
      domain: domainId,
      goal,
      intentSummary: intent.intentSummary || "",
      modulesToTest: targetModules,
      assessedDepth: intent.assessmentDepth || 0,
      learnerLevel,
      includeFullRoadmap,
    });

    const questions = await Question.insertMany(
      (mcqPayload.questions || []).map((q) => ({
        attemptId: attempt._id,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        tags: q.tags,
        modules: q.modules,
        difficulty: q.difficulty,
      }))
    );

    res.json({
      attemptId: attempt._id,
      intent,
      questions: questions.map((q) => ({
        id: q._id,
        prompt: q.prompt,
        options: q.options,
        difficulty: q.difficulty,
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
};

export const submitAssessment = async (req, res, next) => {
  try {
    const { attemptId, answers } = submitSchema.parse(req.body);

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    // Verify ownership: the logged-in user must own this attempt
    if (attempt.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to submit this assessment" });
    }

    // Prevent duplicate submissions
    if (attempt.status === "completed") {
      return res.status(409).json({ error: "This assessment has already been submitted" });
    }

    const questions = await Question.find({ attemptId: attempt._id });
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    const answerDocs = answers.map((a) => {
      const q = questionMap.get(a.questionId);
      const isCorrect = q ? q.correctIndex === a.selectedIndex : false;
      return {
        attemptId: attempt._id,
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        isCorrect,
      };
    });

    await Answer.insertMany(answerDocs);

    const wrongQuestions = [];
    const correctQuestions = [];

    answerDocs.forEach((a) => {
      const q = questionMap.get(a.questionId);
      if (!q) return;
      const entry = {
        prompt: q.prompt,
        tags: q.tags,
        modules: q.modules,
      };
      if (a.isCorrect) correctQuestions.push(entry);
      else wrongQuestions.push(entry);
    });

    const roadmap = getRoadmapById(attempt.domain);

    const evaluation = await evaluateResults({
      domainId: attempt.domain,
      goal: attempt.goal,
      roadmapModules: roadmap.modules,
      wrongQuestions,
      correctQuestions,
    });

    const roadmapResult = await generateAdaptiveRoadmap({
      domainId: attempt.domain,
      goal: attempt.goal,
      roadmapModules: roadmap.modules,
      weakTopics: evaluation.weakTopics || [],
      masteredTopics: evaluation.masteredTopics || [],
      prerequisites: evaluation.neededPrerequisites || [],
      includeFullRoadmap: attempt.includeFullRoadmap || false,
      learnerLevel: attempt.learnerLevel || "intermediate",
    });

    await WeakTopic.insertMany(
      (evaluation.weakTopics || []).map((t) => ({
        attemptId: attempt._id,
        topic: t.topic,
        reason: t.reason,
      }))
    );

    const generatedCsv = roadmapResult.csv || `Module Name,Module Contents\n${(roadmapResult.modules || [])
      .map((m) => `"${m.moduleName}","${(m.topics || []).join("; ")}"`)
      .join("\n")}`;

    const generated = await GeneratedRoadmap.create({
      attemptId: attempt._id,
      csv: generatedCsv,
      modules: (roadmapResult.modules || []).map((m) => m.moduleName),
    });

    attempt.status = "completed";
    attempt.roadmapId = generated._id;
    await attempt.save();

    res.json({
      summary: evaluation.summary,
      weakTopics: evaluation.weakTopics || [],
      masteredTopics: evaluation.masteredTopics || [],
      prerequisites: evaluation.neededPrerequisites || [],
      roadmap: {
        id: generated._id,
        modules: roadmapResult.modules || [],
        csv: roadmapResult.csv,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    next(err);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const attempts = await Attempt.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    const attemptIds = attempts.map((a) => a._id);
    const roadmaps = await GeneratedRoadmap.find({
      attemptId: { $in: attemptIds },
    });

    const roadmapMap = new Map(
      roadmaps.map((r) => [r.attemptId.toString(), r])
    );

    const history = attempts.map((a) => {
      const road = roadmapMap.get(a._id.toString());
      const rmap = getRoadmapById(a.domain);
      return {
        id: a._id,
        domainId: a.domain,
        domainName: rmap ? rmap.name : a.domain,
        goal: a.goal,
        date: a.createdAt,
        status: a.status,
        roadmapId: road ? road._id : null,
      };
    });

    res.json({ history });
  } catch (err) {
    next(err);
  }
};

export const getGeneratedRoadmap = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid roadmap ID" });
    }

    const roadmap = await GeneratedRoadmap.findById(id);
    if (!roadmap) {
      return res.status(404).json({ error: "Roadmap not found" });
    }

    const attempt = await Attempt.findById(roadmap.attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Roadmap not found" });
    }

    // Verify ownership
    if (attempt.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Parse CSV safely and fault-tolerantly since the LLM sometimes
    // puts unquoted commas in the second column.
    let modules = [];
    try {
      let cleanCsv = roadmap.csv;
      if (typeof cleanCsv === "string") {
        cleanCsv = cleanCsv.replace(/\\n/g, "\n");
      }

      const lines = cleanCsv
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 1) {
        modules = lines
          .slice(1)
          .map((line) => {
            const firstComma = line.indexOf(",");
            if (firstComma === -1) return null;

            let moduleName = line.substring(0, firstComma).trim();
            let topicsStr = line.substring(firstComma + 1).trim();

            if (moduleName.startsWith('"') && moduleName.endsWith('"')) {
              moduleName = moduleName.substring(1, moduleName.length - 1);
            }
            if (topicsStr.startsWith('"') && topicsStr.endsWith('"')) {
              topicsStr = topicsStr.substring(1, topicsStr.length - 1);
            }

            const topics = topicsStr
              .split(";")
              .map((t) => t.trim())
              .filter(Boolean);
            return { moduleName, topics };
          })
          .filter(Boolean);
      }
    } catch (parseErr) {
      console.error("CSV Parse Error:", parseErr);
      return res
        .status(500)
        .json({ error: "Failed to parse roadmap structure." });
    }

    res.json({
      roadmap: {
        id: roadmap._id,
        domain: attempt.domain,
        modules,
        csv: roadmap.csv,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getOriginalRoadmap = async (req, res, next) => {
  try {
    const { domainId } = req.params;
    const roadmap = getRoadmapById(domainId);
    if (!roadmap) {
      return res.status(404).json({ error: "Domain not found" });
    }

    // Skip assessment also counts toward daily prompt limit
    const { allowed, user } = await checkAndIncrementPromptLimit(req.user.id);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!allowed) {
      return res.status(429).json({
        error: "Daily prompt limit reached (Max 3/day). Please try again tomorrow.",
      });
    }

    const attempt = await Attempt.create({
      userId: req.user.id,
      domain: domainId,
      goal: "Skipped Assessment (Full Roadmap)",
      intentSummary:
        "User chose to skip the assessment and load the standard roadmap.",
      modulesToTest: [],
      assessedDepth: 0,
      learnerLevel: "beginner",
      includeFullRoadmap: true,
      status: "completed",
    });

    const csv = `Module Name,Module Contents\n${roadmap.modules
      .map((m) => `"${m.moduleName}","${m.topics.join("; ")}"`)
      .join("\n")}`;

    const generated = await GeneratedRoadmap.create({
      attemptId: attempt._id,
      csv,
      modules: roadmap.modules.map((m) => m.moduleName),
    });

    attempt.roadmapId = generated._id;
    await attempt.save();

    res.json({
      summary: "Full roadmap loaded without assessment.",
      weakTopics: [],
      masteredTopics: [],
      prerequisites: [],
      roadmap: {
        id: generated._id,
        domain: domainId,
        modules: roadmap.modules,
        csv,
      },
    });
  } catch (err) {
    next(err);
  }
};

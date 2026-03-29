import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getRoadmapById, loadRoadmaps } from "../src/services/roadmapLoader.js";
import { buildLearningForecast } from "../src/services/learningForecastEngine.js";
import {
  buildAdaptiveAssessmentSignals,
  selectTopicsForNextRound,
  shouldStopAdaptiveAssessment,
} from "../src/services/activeAssessmentEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const backendRoot = path.join(repoRoot, "backend");
const mlResultsDir = path.join(repoRoot, "ml-service", "results");

dotenv.config({ path: path.join(backendRoot, ".env") });

const DEFAULT_ML_URL = "http://127.0.0.1:8001";
const SAMPLE_MAX_QUESTIONS = 12;
const SAMPLE_MIN_QUESTIONS = 7;

const normalize = (text) =>
  typeof text === "string" ? text.trim().toLowerCase() : "";

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const safeReadJson = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

const overlapRate = (a = [], b = []) => {
  const setA = new Set(
    a.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`)
  );
  const setB = new Set(
    b.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`)
  );
  if (!setA.size || !setB.size) return 0;
  const overlap = Array.from(setA).filter((key) => setB.has(key)).length;
  return Math.round((overlap / Math.min(setA.size, setB.size)) * 100);
};

const topTopics = (forecast, count = 5) =>
  (forecast?.recommendations?.priorityNow || [])
    .slice(0, count)
    .map((item) => `${item.topic} (${item.moduleName})`);

const buildAskedTopicCounts = (questionEvents = []) => {
  const counts = new Map();
  questionEvents.forEach((event) => {
    const topics = unique([...(event.tags || []), ...(event.modules || [])]);
    topics.forEach((topic) => {
      const key = normalize(topic);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return counts;
};

const createSampleInput = (roadmap) => {
  const sampledModules = (roadmap.modules || []).slice(0, 4).map((moduleItem) => ({
    moduleName: moduleItem.moduleName,
    topics: (moduleItem.topics || []).slice(0, 3),
  }));

  let hourOffset = 0;
  const difficulties = ["easy", "medium", "hard"];
  const questionEvents = [];

  sampledModules.forEach((moduleItem, moduleIndex) => {
    const topics = moduleItem.topics.slice(0, 2);
    topics.forEach((topic, topicIndex) => {
      hourOffset += 10;
      questionEvents.push({
        isCorrect: (moduleIndex + topicIndex) % 3 !== 0,
        difficulty: difficulties[(moduleIndex + topicIndex) % difficulties.length],
        modules: [moduleItem.moduleName],
        tags: [topic],
        createdAt: new Date(Date.UTC(2026, 2, 18, hourOffset, 0, 0)).toISOString(),
      });
    });
  });

  const completedTopics = sampledModules[0]?.topics?.[0]
    ? [sampledModules[0].topics[0]]
    : [];

  return {
    learnerId: "reviewer-proof-user",
    domain: roadmap.id,
    seedKey: `showcase:${roadmap.id}:2026-03-28`,
    roadmapModules: sampledModules,
    questionEvents,
    completedTopics,
  };
};

const callDktForecast = async ({ payload, baseUrl, apiKey }) => {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/forecast`;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ML service failed (${response.status}): ${body}`);
  }
  return response.json();
};

const run = async () => {
  await fs.mkdir(mlResultsDir, { recursive: true });

  const roadmap = getRoadmapById("python") || loadRoadmaps()[0];
  if (!roadmap) {
    throw new Error("No roadmap files found in backend/data/roadmaps");
  }

  const sampleInput = createSampleInput(roadmap);
  const askedTopicCounts = buildAskedTopicCounts(sampleInput.questionEvents);

  const baselineForecast = buildLearningForecast({
    roadmapModules: sampleInput.roadmapModules,
    questionEvents: sampleInput.questionEvents,
    completedTopics: sampleInput.completedTopics,
    seedKey: sampleInput.seedKey,
  });

  const mlUrl = process.env.ML_FORECAST_URL || DEFAULT_ML_URL;
  const mlApiKey = process.env.ML_FORECAST_API_KEY || process.env.ML_SERVICE_API_KEY || "";

  let dktForecast = null;
  let dktWarning = null;
  try {
    dktForecast = await callDktForecast({
      payload: sampleInput,
      baseUrl: mlUrl,
      apiKey: mlApiKey,
    });
  } catch (error) {
    dktWarning = error.message;
  }

  const effectiveForecast = dktForecast || baselineForecast;

  const savedMlUrl = process.env.ML_FORECAST_URL;
  delete process.env.ML_FORECAST_URL;
  const adaptiveWithoutDl = await buildAdaptiveAssessmentSignals({
    learnerId: sampleInput.learnerId,
    domain: sampleInput.domain,
    roadmapModules: sampleInput.roadmapModules,
    assessmentTopics: sampleInput.roadmapModules.flatMap((moduleItem) => moduleItem.topics),
    questionEvents: sampleInput.questionEvents,
    completedTopics: sampleInput.completedTopics,
    askedTopicCounts,
    seedKey: `${sampleInput.seedKey}:without-dl`,
  });
  const stopWithoutDl = shouldStopAdaptiveAssessment({
    answeredCount: sampleInput.questionEvents.length,
    maxQuestions: SAMPLE_MAX_QUESTIONS,
    minQuestions: SAMPLE_MIN_QUESTIONS,
    topicScores: adaptiveWithoutDl.topicScores,
  });
  const nextWithoutDl = selectTopicsForNextRound({
    topicScores: adaptiveWithoutDl.topicScores,
    batchSize: 4,
  });

  process.env.ML_FORECAST_URL = mlUrl;
  const adaptiveWithDl = await buildAdaptiveAssessmentSignals({
    learnerId: sampleInput.learnerId,
    domain: sampleInput.domain,
    roadmapModules: sampleInput.roadmapModules,
    assessmentTopics: sampleInput.roadmapModules.flatMap((moduleItem) => moduleItem.topics),
    questionEvents: sampleInput.questionEvents,
    completedTopics: sampleInput.completedTopics,
    askedTopicCounts,
    seedKey: `${sampleInput.seedKey}:with-dl`,
  });
  const stopWithDl = shouldStopAdaptiveAssessment({
    answeredCount: sampleInput.questionEvents.length,
    maxQuestions: SAMPLE_MAX_QUESTIONS,
    minQuestions: SAMPLE_MIN_QUESTIONS,
    topicScores: adaptiveWithDl.topicScores,
  });
  const nextWithDl = selectTopicsForNextRound({
    topicScores: adaptiveWithDl.topicScores,
    batchSize: 4,
  });

  if (savedMlUrl === undefined) {
    delete process.env.ML_FORECAST_URL;
  } else {
    process.env.ML_FORECAST_URL = savedMlUrl;
  }

  const offlineQualityProof = await safeReadJson(
    path.join(repoRoot, "ml-service", "results", "model_quality_proof.json")
  );
  const trainMetrics = await safeReadJson(
    path.join(repoRoot, "ml-service", "artifacts", "metrics.json")
  );

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    roadmapUsed: roadmap.id,
    forecastComparison: {
      modeWithoutDl: "baseline-bkt",
      modeWithDl: dktForecast ? "dkt-service" : "baseline-bkt-fallback",
      dktWarning,
      baselineReadiness: baselineForecast?.summary?.readinessScore ?? null,
      withDlReadiness: effectiveForecast?.summary?.readinessScore ?? null,
      readinessDelta:
        (effectiveForecast?.summary?.readinessScore ?? 0) -
        (baselineForecast?.summary?.readinessScore ?? 0),
      priorityOverlapRate: overlapRate(
        baselineForecast?.recommendations?.priorityNow || [],
        effectiveForecast?.recommendations?.priorityNow || []
      ),
      topWithoutDl: topTopics(baselineForecast),
      topWithDl: topTopics(effectiveForecast),
    },
    adaptiveAssessmentComparison: {
      withoutDl: {
        source: adaptiveWithoutDl.source,
        stopDecision: stopWithoutDl,
        nextTopics: nextWithoutDl,
      },
      withDl: {
        source: adaptiveWithDl.source,
        stopDecision: stopWithDl,
        nextTopics: nextWithDl,
      },
    },
    offlineModelQualityProof: offlineQualityProof,
    localTrainMetrics: trainMetrics,
    sampleInput,
  };

  const outJson = path.join(mlResultsDir, "proof_showcase_report.json");
  const outMd = path.join(mlResultsDir, "proof_showcase_report.md");
  await fs.writeFile(outJson, JSON.stringify(reportPayload, null, 2), "utf-8");

  const lines = [
    "# Reviewer Showcase Proof",
    "",
    `Generated at: ${reportPayload.generatedAt}`,
    `Roadmap used: ${reportPayload.roadmapUsed}`,
    "",
    "## 1) Forecast Output Comparison",
    `- Without DL service: ${reportPayload.forecastComparison.modeWithoutDl}`,
    `- With DL service: ${reportPayload.forecastComparison.modeWithDl}`,
    `- Readiness (without DL): ${reportPayload.forecastComparison.baselineReadiness}`,
    `- Readiness (with DL): ${reportPayload.forecastComparison.withDlReadiness}`,
    `- Readiness delta: ${reportPayload.forecastComparison.readinessDelta}`,
    `- Priority overlap: ${reportPayload.forecastComparison.priorityOverlapRate}%`,
    `- Top priorities (without DL): ${reportPayload.forecastComparison.topWithoutDl.join(", ") || "n/a"}`,
    `- Top priorities (with DL): ${reportPayload.forecastComparison.topWithDl.join(", ") || "n/a"}`,
    reportPayload.forecastComparison.dktWarning
      ? `- DL warning: ${reportPayload.forecastComparison.dktWarning}`
      : "- DL warning: none",
    "",
    "## 2) Adaptive Assessment Decision Comparison",
    `- Without DL source: ${reportPayload.adaptiveAssessmentComparison.withoutDl.source}`,
    `- With DL source: ${reportPayload.adaptiveAssessmentComparison.withDl.source}`,
    `- Next topics (without DL): ${reportPayload.adaptiveAssessmentComparison.withoutDl.nextTopics.join(", ") || "n/a"}`,
    `- Next topics (with DL): ${reportPayload.adaptiveAssessmentComparison.withDl.nextTopics.join(", ") || "n/a"}`,
    `- Stop reason (without DL): ${reportPayload.adaptiveAssessmentComparison.withoutDl.stopDecision.reason}`,
    `- Stop reason (with DL): ${reportPayload.adaptiveAssessmentComparison.withDl.stopDecision.reason}`,
    "",
    "## 3) Offline Model Quality Proof",
    reportPayload.offlineModelQualityProof
      ? `- Verdict: ${reportPayload.offlineModelQualityProof.comparison?.verdict || "n/a"}`
      : "- Verdict: unavailable (run model-quality proof first)",
    reportPayload.offlineModelQualityProof
      ? `- DKT wins: ${reportPayload.offlineModelQualityProof.comparison?.wins?.total || 0}/3 metrics`
      : "- DKT wins: n/a",
    reportPayload.localTrainMetrics
      ? `- Local train AUC: ${reportPayload.localTrainMetrics.auc}`
      : "- Local train AUC: n/a",
    "",
    "## Raw Data",
    `- JSON report: ${path.relative(repoRoot, outJson).replace(/\\/g, "/")}`,
  ];

  await fs.writeFile(outMd, `${lines.join("\n")}\n`, "utf-8");

  console.log(`Saved: ${outJson}`);
  console.log(`Saved: ${outMd}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});


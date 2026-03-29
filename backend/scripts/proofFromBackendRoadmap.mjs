import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { buildLearningForecast } from "../src/services/learningForecastEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const backendRoot = path.join(repoRoot, "backend");
const resultsDir = path.join(repoRoot, "ml-service", "results");

const argv = process.argv.slice(2);
const requestedRoadmap = argv[0] || "python-roadmap.csv";
const roadmapPath = path.join(backendRoot, "data", "roadmaps", requestedRoadmap);

const normalize = (text) => (typeof text === "string" ? text.trim().toLowerCase() : "");

const parseRoadmapModules = (csvText) => {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return rows
    .map((row) => {
      const moduleName = (row["Module Name"] || "Unnamed Module").trim();
      const topicsRaw = (row["Module Contents"] || "").trim();
      const topics = topicsRaw
        .split(";")
        .map((topic) => topic.trim())
        .filter(Boolean);

      return { moduleName, topics };
    })
    .filter((item) => item.topics.length > 0);
};

const buildInputFromRoadmap = (modules) => {
  const sampledModules = modules.slice(0, 4);
  const firstTopic = sampledModules[0]?.topics[0] || "General Foundations";

  const questionEvents = [];
  let hourOffset = 0;

  sampledModules.forEach((module, moduleIdx) => {
    const topics = module.topics.slice(0, 2);
    topics.forEach((topic, topicIdx) => {
      hourOffset += 8;
      const isCorrect = (moduleIdx + topicIdx) % 2 === 0;
      const difficulty = topicIdx % 2 === 0 ? "medium" : "hard";
      questionEvents.push({
        isCorrect,
        difficulty,
        modules: [module.moduleName],
        tags: [topic],
        createdAt: new Date(Date.UTC(2026, 2, 18, hourOffset, 0, 0)).toISOString(),
      });
    });
  });

  return {
    learnerId: "backend-roadmap-proof-user",
    domain: requestedRoadmap.replace(/-roadmap\.csv$/i, ""),
    seedKey: `proof:${requestedRoadmap}:2026-03-23`,
    roadmapModules: sampledModules,
    questionEvents,
    completedTopics: [firstTopic],
  };
};

const overlapRate = (a = [], b = []) => {
  const setA = new Set(a.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`));
  const setB = new Set(b.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`));
  if (setA.size === 0 || setB.size === 0) return 0;
  const overlap = Array.from(setA).filter((key) => setB.has(key)).length;
  return Math.round((overlap / Math.min(setA.size, setB.size)) * 100);
};

const run = async () => {
  await fs.mkdir(resultsDir, { recursive: true });

  const csvText = await fs.readFile(roadmapPath, "utf-8");
  const roadmapModules = parseRoadmapModules(csvText);

  if (!roadmapModules.length) {
    throw new Error(`No modules parsed from ${roadmapPath}`);
  }

  const sampleInput = buildInputFromRoadmap(roadmapModules);

  const baselineForecast = buildLearningForecast({
    roadmapModules: sampleInput.roadmapModules,
    questionEvents: sampleInput.questionEvents,
    completedTopics: sampleInput.completedTopics,
    seedKey: sampleInput.seedKey,
  });

  let dktForecast = null;
  let source = "baseline-only";
  let warning = null;

  try {
    const response = await fetch("http://127.0.0.1:8001/v1/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleInput),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ML service failed (${response.status}): ${body}`);
    }

    dktForecast = await response.json();
    source = "dkt-service";
  } catch (err) {
    warning = `ML service unavailable, fallback used: ${err.message}`;
  }

  const effectiveForecast = dktForecast || baselineForecast;

  const payload = {
    proof: {
      roadmapFile: path.relative(repoRoot, roadmapPath).replace(/\\/g, "/"),
      modulesInRoadmap: roadmapModules.length,
      topicsInRoadmap: roadmapModules.reduce((sum, m) => sum + m.topics.length, 0),
      sampledModuleNames: sampleInput.roadmapModules.map((m) => m.moduleName),
      sampleInputEvents: sampleInput.questionEvents.length,
    },
    forecastV2Envelope: {
      domain: sampleInput.domain,
      source,
      warning,
      baselineForecast,
      dktForecast,
      effectiveForecast,
      comparison: {
        readinessDelta:
          (effectiveForecast?.summary?.readinessScore ?? 0) -
          (baselineForecast?.summary?.readinessScore ?? 0),
        priorityOverlapRate: overlapRate(
          baselineForecast?.recommendations?.priorityNow || [],
          effectiveForecast?.recommendations?.priorityNow || []
        ),
        baselineTopK: (baselineForecast?.recommendations?.priorityNow || []).length,
        advancedTopK: (effectiveForecast?.recommendations?.priorityNow || []).length,
      },
    },
    sampleInput,
  };

  const outJson = path.join(resultsDir, "backend_roadmap_usage_proof.json");
  const outMd = path.join(resultsDir, "backend_roadmap_usage_proof.md");

  await fs.writeFile(outJson, JSON.stringify(payload, null, 2), "utf-8");

  const lines = [
    "# Backend Roadmap Usage Proof",
    "",
    "This report proves a roadmap file from backend/data/roadmaps was used as input.",
    "",
    `- Roadmap file: ${payload.proof.roadmapFile}`,
    `- Modules parsed: ${payload.proof.modulesInRoadmap}`,
    `- Topics parsed: ${payload.proof.topicsInRoadmap}`,
    `- Sampled modules used: ${payload.proof.sampledModuleNames.join(", ")}`,
    `- Generated question events: ${payload.proof.sampleInputEvents}`,
    "",
    "## Forecast Comparison (same input)",
    `- Source: ${source}`,
    `- Warning: ${warning || "none"}`,
    `- Baseline readiness: ${baselineForecast?.summary?.readinessScore ?? "n/a"}`,
    `- Effective readiness: ${effectiveForecast?.summary?.readinessScore ?? "n/a"}`,
    `- Readiness delta: ${payload.forecastV2Envelope.comparison.readinessDelta}`,
    `- Priority overlap rate: ${payload.forecastV2Envelope.comparison.priorityOverlapRate}%`,
    "",
    `Raw JSON log: ${path.relative(repoRoot, outJson).replace(/\\/g, "/")}`,
  ];

  await fs.writeFile(outMd, `${lines.join("\n")}\n`, "utf-8");

  console.log(`Saved: ${outJson}`);
  console.log(`Saved: ${outMd}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

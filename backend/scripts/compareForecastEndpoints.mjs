import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLearningForecast } from "../src/services/learningForecastEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const resultsDir = path.join(repoRoot, "ml-service", "results");

const normalize = (text) => (typeof text === "string" ? text.trim().toLowerCase() : "");

const overlapRate = (a = [], b = []) => {
  const setA = new Set(a.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`));
  const setB = new Set(b.map((item) => `${normalize(item.moduleName)}::${normalize(item.topic)}`));
  if (setA.size === 0 || setB.size === 0) return 0;
  const overlap = Array.from(setA).filter((key) => setB.has(key)).length;
  return Math.round((overlap / Math.min(setA.size, setB.size)) * 100);
};

const sampleInput = {
  learnerId: "compare-user-01",
  domain: "python",
  seedKey: "compare-seed-2026-03-23",
  roadmapModules: [
    { moduleName: "Basics", topics: ["Variables", "Control Flow", "Functions"] },
    { moduleName: "Data Structures", topics: ["Lists", "Dictionaries", "Sets"] },
    { moduleName: "Web", topics: ["FastAPI", "Flask"] },
  ],
  questionEvents: [
    {
      isCorrect: true,
      difficulty: "easy",
      modules: ["Basics"],
      tags: ["Variables"],
      createdAt: "2026-03-20T10:00:00Z",
    },
    {
      isCorrect: false,
      difficulty: "hard",
      modules: ["Basics"],
      tags: ["Control Flow"],
      createdAt: "2026-03-21T10:00:00Z",
    },
    {
      isCorrect: true,
      difficulty: "medium",
      modules: ["Data Structures"],
      tags: ["Lists"],
      createdAt: "2026-03-21T15:00:00Z",
    },
    {
      isCorrect: false,
      difficulty: "medium",
      modules: ["Web"],
      tags: ["FastAPI"],
      createdAt: "2026-03-22T10:00:00Z",
    },
  ],
  completedTopics: ["Variables"],
};

const run = async () => {
  await fs.mkdir(resultsDir, { recursive: true });

  // Equivalent to backend /api/progress/forecast payload internals
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
    warning = `Advanced ML unavailable, fallback baseline used: ${err.message}`;
  }

  const effectiveForecast = dktForecast || baselineForecast;

  // This mirrors backend /api/progress/forecast-v2 response shape consumed by frontend.
  const forecastV2Envelope = {
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
  };

  const outJson = path.join(resultsDir, "endpoint_comparison_same_input.json");
  const outMd = path.join(resultsDir, "endpoint_comparison_same_input.md");

  await fs.writeFile(outJson, JSON.stringify({ sampleInput, forecastV2Envelope }, null, 2), "utf-8");

  const md = [
    "# Endpoint Comparison (Same Input)",
    "",
    "This proof compares outputs with and without ML service for the same request payload.",
    "",
    "## Endpoint Mapping",
    "- Baseline (without ML service): backend `GET /api/progress/forecast` equivalent",
    "- Mixed/advanced (with ML service): backend `GET /api/progress/forecast-v2` equivalent envelope",
    "- Frontend consumers: `fetchLearningForecast` and `fetchLearningForecastV2`",
    "",
    "## Run Summary",
    `- Source: ${source}`,
    `- Warning: ${warning || "none"}`,
    `- Baseline readiness: ${baselineForecast?.summary?.readinessScore ?? "n/a"}`,
    `- Effective readiness: ${effectiveForecast?.summary?.readinessScore ?? "n/a"}`,
    `- Readiness delta: ${forecastV2Envelope.comparison.readinessDelta}`,
    `- Priority overlap rate: ${forecastV2Envelope.comparison.priorityOverlapRate}%`,
    "",
    "## Top Priority Topics",
    "- Baseline: " + (baselineForecast?.recommendations?.priorityNow || []).slice(0, 3).map((t) => `${t.topic} (${t.moduleName})`).join(", "),
    "- Effective: " + (effectiveForecast?.recommendations?.priorityNow || []).slice(0, 3).map((t) => `${t.topic} (${t.moduleName})`).join(", "),
    "",
    `Raw JSON log: ${path.relative(repoRoot, outJson).replace(/\\/g, "/")}`,
  ].join("\n");

  await fs.writeFile(outMd, md, "utf-8");

  console.log(`Saved: ${outJson}`);
  console.log(`Saved: ${outMd}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

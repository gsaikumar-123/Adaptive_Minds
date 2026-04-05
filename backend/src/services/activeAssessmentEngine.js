import { buildLearningForecast } from "./learningForecastEngine.js";
import { fetchDktForecast } from "./mlForecastClient.js";

const normalize = (text) =>
  typeof text === "string" ? text.trim().toLowerCase() : "";

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildTopicModuleIndex = (roadmapModules = []) => {
  const index = new Map();
  roadmapModules.forEach((moduleItem) => {
    const moduleName = moduleItem?.moduleName || "General Foundations";
    const topics = Array.isArray(moduleItem?.topics) ? moduleItem.topics : [];
    topics.forEach((topic) => {
      index.set(normalize(topic), moduleName);
    });
  });
  return index;
};

const buildForecastMap = (forecast) => {
  const map = new Map();
  const topics = Array.isArray(forecast?.topics) ? forecast.topics : [];
  topics.forEach((row) => {
    map.set(normalize(row.topic), row);
  });
  return map;
};

const scoreTopics = ({
  assessmentTopics,
  topicModuleIndex,
  forecastMap,
  askedTopicCounts,
}) => {
  return unique(assessmentTopics).map((topic) => {
    const key = normalize(topic);
    const signal = forecastMap.get(key);
    const masteryProbability = clamp(
      Number(signal?.masteryProbability ?? 0.5),
      0.01,
      0.99
    );
    const uncertainty = 1 - Math.abs(2 * masteryProbability - 1);
    const weakness = 1 - masteryProbability;
    const askedCount = askedTopicCounts.get(key) || 0;
    const novelty = askedCount === 0 ? 1 : 1 / (askedCount + 1);

    // Higher scores mean this topic will likely reduce uncertainty fastest.
    const expectedGain =
      (0.55 * uncertainty + 0.35 * weakness + 0.1 * novelty) *
      (1 / (1 + askedCount * 0.45));

    return {
      topic,
      moduleName: topicModuleIndex.get(key) || "General Foundations",
      masteryProbability: Math.round(masteryProbability * 1000) / 1000,
      uncertainty: Math.round(uncertainty * 1000) / 1000,
      expectedGain: Math.round(expectedGain * 1000) / 1000,
      askedCount,
      evidenceCount: signal?.evidenceCount ?? 0,
    };
  });
};

export const buildAdaptiveAssessmentSignals = async ({
  learnerId,
  domain,
  roadmapModules,
  assessmentTopics,
  questionEvents,
  completedTopics,
  askedTopicCounts,
  seedKey,
}) => {
  const baselineForecast = buildLearningForecast({
    roadmapModules,
    questionEvents,
    completedTopics,
    seedKey,
  });

  let dktForecast = null;
  let source = "baseline-bkt";
  let warning = null;

  try {
    dktForecast = await fetchDktForecast({
      learnerId,
      domain,
      roadmapModules,
      questionEvents,
      completedTopics,
      seedKey,
    });
    if (dktForecast) {
      source = "dkt-service";
    }
  } catch (error) {
    source = "baseline-bkt-fallback";
    warning = `Advanced ML service unavailable. Returned baseline forecast. (${error?.message || "unknown-error"})`;
  }

  const effectiveForecast = dktForecast || baselineForecast;
  const topicModuleIndex = buildTopicModuleIndex(roadmapModules);
  const forecastMap = buildForecastMap(effectiveForecast);
  const topicScores = scoreTopics({
    assessmentTopics,
    topicModuleIndex,
    forecastMap,
    askedTopicCounts,
  }).sort((a, b) => {
    if (b.expectedGain !== a.expectedGain) {
      return b.expectedGain - a.expectedGain;
    }
    return b.uncertainty - a.uncertainty;
  });

  return {
    source,
    warning,
    topicScores,
    baselineForecast,
    dktForecast,
    effectiveForecast,
  };
};

export const shouldStopAdaptiveAssessment = ({
  answeredCount,
  maxQuestions,
  minQuestions,
  topicScores,
}) => {
  const budgetReached = answeredCount >= maxQuestions;
  if (budgetReached) {
    return {
      stop: true,
      reason: "max-question-budget",
      averageUncertainty: 0,
      averageExpectedGain: 0,
    };
  }

  if (answeredCount < minQuestions) {
    return {
      stop: false,
      reason: "min-question-floor",
      averageUncertainty: 1,
      averageExpectedGain: 1,
    };
  }

  const unresolved = topicScores.filter((topic) => topic.askedCount === 0);
  if (!unresolved.length) {
    return {
      stop: true,
      reason: "topic-coverage-complete",
      averageUncertainty: 0,
      averageExpectedGain: 0,
    };
  }

  const windowSize = Math.min(8, Math.max(3, unresolved.length));
  const topWindow = unresolved.slice(0, windowSize);
  const averageUncertainty =
    topWindow.reduce((sum, item) => sum + item.uncertainty, 0) / windowSize;
  const averageExpectedGain =
    topWindow.reduce((sum, item) => sum + item.expectedGain, 0) / windowSize;

  const confidentEnough =
    averageUncertainty < 0.22 && averageExpectedGain < 0.34;

  return {
    stop: confidentEnough,
    reason: confidentEnough ? "confidence-threshold-reached" : "need-more-evidence",
    averageUncertainty: Math.round(averageUncertainty * 1000) / 1000,
    averageExpectedGain: Math.round(averageExpectedGain * 1000) / 1000,
  };
};

export const selectTopicsForNextRound = ({ topicScores, batchSize }) => {
  const target = Math.max(1, batchSize);
  const selected = [];
  const selectedModules = new Set();

  const unresolved = topicScores.filter((topic) => topic.askedCount === 0);

  // Pass 1: maximize module diversity.
  unresolved.forEach((topic) => {
    if (selected.length >= target) return;
    const moduleKey = normalize(topic.moduleName);
    if (!selectedModules.has(moduleKey)) {
      selected.push(topic);
      selectedModules.add(moduleKey);
    }
  });

  // Pass 2: fill remaining slots with best unresolved topics.
  unresolved.forEach((topic) => {
    if (selected.length >= target) return;
    if (!selected.some((item) => normalize(item.topic) === normalize(topic.topic))) {
      selected.push(topic);
    }
  });

  return selected.slice(0, target).map((item) => item.topic);
};


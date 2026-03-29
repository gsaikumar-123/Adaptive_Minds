const DIFFICULTY_PARAMS = {
  easy: { guess: 0.25, slip: 0.12, transition: 0.18 },
  medium: { guess: 0.2, slip: 0.1, transition: 0.14 },
  hard: { guess: 0.15, slip: 0.08, transition: 0.1 },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalize = (text) => (typeof text === "string" ? text.trim().toLowerCase() : "");

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const runBktStep = (priorLearned, isCorrect, params) => {
  const { guess, slip, transition } = params;
  const safePrior = clamp(priorLearned, 0.001, 0.999);

  let posterior;
  if (isCorrect) {
    const numerator = safePrior * (1 - slip);
    const denominator = numerator + (1 - safePrior) * guess;
    posterior = denominator > 0 ? numerator / denominator : safePrior;
  } else {
    const numerator = safePrior * slip;
    const denominator = numerator + (1 - safePrior) * (1 - guess);
    posterior = denominator > 0 ? numerator / denominator : safePrior;
  }

  // Standard BKT learning transition after each observation.
  return posterior + (1 - posterior) * transition;
};

const applyForgettingDecay = (masteryProbability, lastObservationAt) => {
  if (!lastObservationAt) return masteryProbability;

  const daysInactive = Math.max(
    0,
    (Date.now() - new Date(lastObservationAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const lambda = 0.015;
  return masteryProbability * Math.exp(-lambda * daysInactive);
};

const confidenceFromEvidence = (observationCount, lastObservationAt) => {
  const evidenceScore = clamp(Math.sqrt(observationCount) * 30, 0, 85);
  if (!lastObservationAt) return Math.round(evidenceScore);

  const daysInactive = Math.max(
    0,
    (Date.now() - new Date(lastObservationAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const freshnessPenalty = clamp(daysInactive * 0.9, 0, 30);
  return Math.round(clamp(evidenceScore + 15 - freshnessPenalty, 20, 97));
};

const classifyRecommendation = (masteryScore, confidence) => {
  if (masteryScore >= 78 && confidence >= 55) return "Maintain";
  if (masteryScore >= 52) return "Reinforce";
  return "Priority Focus";
};

const buildEvidenceMap = (questionEvents) => {
  const evidenceMap = new Map();

  questionEvents.forEach((event) => {
    const keys = [];

    (event.tags || []).forEach((tag) => {
      const key = normalize(tag);
      if (key) keys.push(key);
    });

    (event.modules || []).forEach((moduleName) => {
      const key = normalize(moduleName);
      if (key) keys.push(key);
    });

    if (!keys.length) {
      keys.push("general foundations");
    }

    keys.forEach((key) => {
      const existing = evidenceMap.get(key) || [];
      existing.push(event);
      evidenceMap.set(key, existing);
    });
  });

  return evidenceMap;
};

const computeTopicForecast = ({ topicName, moduleName, completedSet, evidenceMap, globalPrior }) => {
  const topicKey = normalize(topicName);
  const moduleKey = normalize(moduleName);

  const topicEvidence = evidenceMap.get(topicKey) || [];
  const moduleEvidence = evidenceMap.get(moduleKey) || [];

  const mergedEvidence = [...topicEvidence, ...moduleEvidence].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const isCompleted = completedSet.has(topicName);

  let prior = clamp(globalPrior + (isCompleted ? 0.35 : 0), 0.1, 0.9);
  if (!mergedEvidence.length && isCompleted) {
    prior = Math.max(prior, 0.76);
  }

  let lastObservationAt = null;

  mergedEvidence.forEach((event) => {
    const params = DIFFICULTY_PARAMS[event.difficulty] || DIFFICULTY_PARAMS.medium;
    prior = runBktStep(prior, event.isCorrect, params);
    lastObservationAt = event.createdAt;
  });

  const decayedMastery = applyForgettingDecay(prior, lastObservationAt);
  const masteryScore = Math.round(clamp(decayedMastery * 100, 0, 100));
  const confidence = confidenceFromEvidence(mergedEvidence.length, lastObservationAt);
  const recommendation = classifyRecommendation(masteryScore, confidence);
  const priorityScore = Math.round(clamp((100 - masteryScore) * (1 + (100 - confidence) / 140), 0, 100));

  return {
    topic: topicName,
    moduleName,
    masteryProbability: round(decayedMastery),
    masteryScore,
    confidence,
    recommendation,
    priorityScore,
    evidenceCount: mergedEvidence.length,
    completedByUser: isCompleted,
    lastObservationAt,
  };
};

const hashSeed = (text) => {
  const value = typeof text === "string" ? text : "adaptive-seed";
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
};

const createDeterministicRandom = (seedText) => {
  let state = hashSeed(seedText);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000000) / 1000000;
  };
};

const sampleGamma = (shape, random) => {
  if (shape < 1) {
    const u = Math.max(random(), 1e-8);
    return sampleGamma(shape + 1, random) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x;
    let v;

    do {
      const u1 = Math.max(random(), 1e-8);
      const u2 = Math.max(random(), 1e-8);
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      x = z;
      v = 1 + c * x;
    } while (v <= 0);

    v = v ** 3;
    const u = Math.max(random(), 1e-8);
    if (u < 1 - 0.0331 * (x ** 4)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
};

const sampleBeta = (alpha, beta, random) => {
  const x = sampleGamma(alpha, random);
  const y = sampleGamma(beta, random);
  return x / (x + y);
};

const buildContextualBanditPolicy = ({ topicForecasts, roadmapModules, seedKey }) => {
  const random = createDeterministicRandom(seedKey);
  const moduleOrder = new Map(
    (roadmapModules || []).map((moduleItem, index) => [moduleItem.moduleName || "Unnamed Module", index])
  );

  const candidateActions = topicForecasts
    .filter((topic) => topic.recommendation !== "Maintain")
    .map((topic) => {
      const masteryProb = clamp(topic.masteryProbability, 0.01, 0.99);
      const confidenceProb = clamp(topic.confidence / 100, 0.01, 0.99);

      const alpha = 1 + (1 - masteryProb) * 7 + (1 - confidenceProb) * 3;
      const beta = 1 + masteryProb * 7 + confidenceProb * 2;
      const sampledReward = sampleBeta(alpha, beta, random);

      const moduleIdx = moduleOrder.get(topic.moduleName) ?? 0;
      const sequencePenalty = clamp(moduleIdx * 0.018, 0, 0.22);
      const completionBoost = topic.completedByUser ? -0.08 : 0;
      const explorationBoost = (1 - confidenceProb) * 0.24;

      const actionScore = clamp(sampledReward + explorationBoost - sequencePenalty + completionBoost, 0, 1);

      return {
        ...topic,
        alpha: round(alpha),
        beta: round(beta),
        sampledReward: round(sampledReward),
        actionScore: round(actionScore),
      };
    })
    .sort((a, b) => b.actionScore - a.actionScore);

  const chosen = candidateActions.slice(0, 9);
  const sessions = [];

  for (let day = 0; day < 3; day += 1) {
    const start = day * 3;
    const topics = chosen.slice(start, start + 3).map((item) => ({
      topic: item.topic,
      moduleName: item.moduleName,
      reason: `score=${item.actionScore}, uncertainty=${100 - item.confidence}%`,
      expectedGain: Math.round((1 - item.masteryProbability) * 100 * item.actionScore),
    }));

    if (topics.length) {
      sessions.push({
        day: day + 1,
        focus: day === 0 ? "Exploit weak-core" : day === 1 ? "Explore uncertain topics" : "Consolidate gains",
        topics,
      });
    }
  }

  const avgActionScore = chosen.length
    ? chosen.reduce((sum, item) => sum + item.actionScore, 0) / chosen.length
    : 0;

  const expectedGainScore = Math.round(
    chosen.reduce((sum, item) => sum + (1 - item.masteryProbability) * item.actionScore * 100, 0)
  );

  const remainingTopics = topicForecasts.filter((topic) => topic.masteryScore < 78).length;
  const naiveDays = Math.ceil(remainingTopics / 2);
  const adaptiveDays = Math.max(1, Math.ceil(naiveDays * (1 - avgActionScore * 0.35)));

  return {
    algorithm: "Contextual Thompson Sampling",
    version: "cts-v1",
    selectedActions: chosen.slice(0, 12),
    sessions,
    productivity: {
      expectedGainScore,
      naiveDays,
      adaptiveDays,
      estimatedDaysSaved: Math.max(0, naiveDays - adaptiveDays),
    },
  };
};

export const buildLearningForecast = ({ roadmapModules, questionEvents, completedTopics, seedKey }) => {
  const completedSet = new Set(completedTopics || []);
  const evidenceMap = buildEvidenceMap(questionEvents || []);

  const totalEvents = (questionEvents || []).length;
  const correctEvents = (questionEvents || []).filter((event) => event.isCorrect).length;
  const globalPrior = clamp(0.25 + (totalEvents ? correctEvents / totalEvents : 0) * 0.4, 0.2, 0.75);

  const topicForecasts = [];

  (roadmapModules || []).forEach((moduleItem) => {
    const moduleName = moduleItem.moduleName || "Unnamed Module";
    const topics = Array.isArray(moduleItem.topics) ? moduleItem.topics : [];

    topics.forEach((topicName) => {
      topicForecasts.push(
        computeTopicForecast({
          topicName,
          moduleName,
          completedSet,
          evidenceMap,
          globalPrior,
        })
      );
    });
  });

  const sortedByPriority = [...topicForecasts].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.masteryScore - b.masteryScore;
  });

  const meanMastery = topicForecasts.length
    ? topicForecasts.reduce((sum, item) => sum + item.masteryScore, 0) / topicForecasts.length
    : 0;

  const meanConfidence = topicForecasts.length
    ? topicForecasts.reduce((sum, item) => sum + item.confidence, 0) / topicForecasts.length
    : 0;

  const readinessScore = Math.round(clamp(meanMastery * 0.72 + meanConfidence * 0.28, 0, 100));
  const policy = buildContextualBanditPolicy({
    topicForecasts,
    roadmapModules,
    seedKey: seedKey || "adaptive-roadmap",
  });

  return {
    model: {
      name: "Bayesian Knowledge Tracing",
      version: "bkt-v1",
      notes: [
        "Per-topic mastery is updated with BKT posterior over assessment observations.",
        "Forgetting decay is applied using inactivity since last evidence.",
        "Priority score combines mastery gap and confidence uncertainty.",
        "A contextual Thompson Sampling policy turns forecasts into weekly action plans.",
      ],
    },
    summary: {
      readinessScore,
      averageMasteryScore: Math.round(meanMastery),
      averageConfidence: Math.round(meanConfidence),
      totalTopics: topicForecasts.length,
      totalEvidenceEvents: totalEvents,
    },
    recommendations: {
      priorityNow: sortedByPriority.slice(0, 8),
      maintain: topicForecasts
        .filter((item) => item.recommendation === "Maintain")
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .slice(0, 8),
    },
    policy,
    topics: topicForecasts,
    generatedAt: new Date().toISOString(),
  };
};

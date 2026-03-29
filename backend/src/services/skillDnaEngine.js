const DIFFICULTY_WEIGHT = {
  easy: 1,
  medium: 1.4,
  hard: 1.9,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeModuleName = (name) => {
  if (!name || typeof name !== "string") return "General Foundations";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "General Foundations";
};

const computeConsistency = (answerDocs, questionMap) => {
  if (!answerDocs.length) return 0;

  const weightedOutcomes = answerDocs.map((answer) => {
    const question = questionMap.get(answer.questionId.toString());
    const weight = DIFFICULTY_WEIGHT[question?.difficulty] || 1;
    return answer.isCorrect ? weight : 0;
  });

  const mean = weightedOutcomes.reduce((sum, value) => sum + value, 0) / weightedOutcomes.length;
  const variance =
    weightedOutcomes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / weightedOutcomes.length;

  // Low variance means the learner performs consistently across questions.
  const normalized = 100 - clamp((Math.sqrt(variance) / 2) * 100, 0, 100);
  return Math.round(normalized);
};

export const buildSkillDna = ({ questions, answers }) => {
  const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));
  const moduleStats = new Map();

  let totalWeighted = 0;
  let totalWeightedCorrect = 0;

  answers.forEach((answer) => {
    const question = questionMap.get(answer.questionId.toString());
    if (!question) return;

    const weight = DIFFICULTY_WEIGHT[question.difficulty] || 1;
    const moduleNames = (question.modules || []).length
      ? question.modules
      : (question.tags || []).length
      ? question.tags
      : ["General Foundations"];

    totalWeighted += weight;
    if (answer.isCorrect) totalWeightedCorrect += weight;

    moduleNames.map(normalizeModuleName).forEach((moduleName) => {
      const current = moduleStats.get(moduleName) || {
        moduleName,
        attempts: 0,
        weightedAttempts: 0,
        weightedCorrect: 0,
        hardWeightedAttempts: 0,
        hardWeightedMisses: 0,
      };

      current.attempts += 1;
      current.weightedAttempts += weight;
      if (answer.isCorrect) {
        current.weightedCorrect += weight;
      }
      if (question.difficulty === "hard") {
        current.hardWeightedAttempts += weight;
        if (!answer.isCorrect) {
          current.hardWeightedMisses += weight;
        }
      }

      moduleStats.set(moduleName, current);
    });
  });

  const modules = Array.from(moduleStats.values()).map((moduleStat) => {
    const accuracy = moduleStat.weightedAttempts
      ? (moduleStat.weightedCorrect / moduleStat.weightedAttempts) * 100
      : 0;

    const hardMissRatio = moduleStat.hardWeightedAttempts
      ? moduleStat.hardWeightedMisses / moduleStat.hardWeightedAttempts
      : 0;

    const confidence = clamp(
      Math.round(52 + Math.sqrt(moduleStat.attempts) * 11 + (moduleStat.weightedAttempts / 10) * 8),
      35,
      98
    );

    const priorityIndex = clamp(
      Math.round((100 - accuracy) * (1 + hardMissRatio * 0.9) * (1 + (100 - confidence) / 200)),
      0,
      100
    );

    const recommendation =
      priorityIndex >= 70
        ? "Immediate Focus"
        : priorityIndex >= 45
        ? "Reinforce Soon"
        : "Maintain";

    return {
      moduleName: moduleStat.moduleName,
      attempts: moduleStat.attempts,
      masteryScore: Math.round(accuracy),
      confidence,
      priorityIndex,
      recommendation,
      hardQuestionRisk: Math.round(hardMissRatio * 100),
    };
  });

  const rankedModules = modules.sort((a, b) => {
    if (b.priorityIndex !== a.priorityIndex) return b.priorityIndex - a.priorityIndex;
    return a.masteryScore - b.masteryScore;
  });

  const weightedAccuracy = totalWeighted ? Math.round((totalWeightedCorrect / totalWeighted) * 100) : 0;
  const consistency = computeConsistency(answers, questionMap);

  const readinessScore = clamp(
    Math.round(weightedAccuracy * 0.7 + consistency * 0.3),
    0,
    100
  );

  return {
    overall: {
      weightedAccuracy,
      consistency,
      readinessScore,
      totalQuestions: answers.length,
    },
    modules: rankedModules,
    signature: [
      {
        label: "Difficulty-weighted scoring",
        detail: "easy=1.0, medium=1.4, hard=1.9",
      },
      {
        label: "Priority Index",
        detail: "Ranks modules using mastery gap, hard-question misses, and confidence",
      },
      {
        label: "Readiness score",
        detail: "Combines weighted accuracy and consistency into one interview-friendly metric",
      },
    ],
    generatedAt: new Date().toISOString(),
    modelVersion: "skill-dna-v1",
  };
};

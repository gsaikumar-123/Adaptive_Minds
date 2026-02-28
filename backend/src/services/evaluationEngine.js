import { groqChat } from "./groqClient.js";
import { evaluationPrompt } from "../prompts/evaluation.js";

const REASONING_MODEL = "llama-3.3-70b-versatile";

export const evaluateResults = async ({ domainId, goal, roadmapModules, wrongQuestions, correctQuestions }) => {
  const messages = [
    { role: "system", content: "You are a precise learning diagnostician." },
    {
      role: "user",
      content: evaluationPrompt({ domainId, goal, roadmapModules, wrongQuestions, correctQuestions })
    }
  ];

  return groqChat({ model: REASONING_MODEL, messages, temperature: 0.1, maxTokens: 2000 });
};

import { groqChat } from "./groqClient.js";
import { roadmapSynthesisPrompt } from "../prompts/roadmapSynthesis.js";

const REASONING_MODEL = "llama-3.3-70b-versatile";

export const generateAdaptiveRoadmap = async ({ domainId, goal, roadmapModules, weakTopics, masteredTopics, prerequisites, includeFullRoadmap, learnerLevel }) => {
  const messages = [
    { role: "system", content: "You are a curriculum designer." },
    {
      role: "user",
      content: roadmapSynthesisPrompt({ domainId, goal, roadmapModules, weakTopics, masteredTopics, prerequisites, includeFullRoadmap, learnerLevel })
    }
  ];

  return groqChat({ model: REASONING_MODEL, messages, temperature: 0.1, maxTokens: 2000 });
};

import { groqChat } from "./groqClient.js";
import { intentAnalysisPrompt } from "../prompts/intentAnalysis.js";

const REASONING_MODEL = "llama-3.3-70b-versatile";

export const analyzeIntent = async ({ domainId, goal, roadmap }) => {
  const messages = [
    {
      role: "system",
      content: "You are a senior learning-science architect."
    },
    {
      role: "user",
      content: intentAnalysisPrompt({ domainId, goal, roadmap })
    }
  ];

  return groqChat({ model: REASONING_MODEL, messages, temperature: 0.1, maxTokens: 2000 });
};

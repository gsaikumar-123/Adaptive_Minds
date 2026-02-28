import { groqChat } from "./groqClient.js";
import { mcqGenerationPrompt } from "../prompts/mcqGeneration.js";

const MCQ_MODEL = "llama-3.1-8b-instant";

export const generateMcqs = async ({
  domainId,
  goal,
  assessmentTopics,
  roadmapModules,
  maxQuestions,
  learnerLevel,
}) => {
  const messages = [
    { role: "system", content: "You are a rigorous assessment generator." },
    {
      role: "user",
      content: mcqGenerationPrompt({
        domainId,
        goal,
        assessmentTopics,
        roadmapModules,
        maxQuestions,
        learnerLevel,
      }),
    },
  ];

  return groqChat({ model: MCQ_MODEL, messages, temperature: 0.2, maxTokens: 3000 });
};

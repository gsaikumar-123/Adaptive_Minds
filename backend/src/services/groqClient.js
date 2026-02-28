const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const groqChat = async ({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 2500,
}) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`Groq API error (${response.status}): ${errText}`);
        err.status = response.status;

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw err;
        }
        lastError = err;
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("Groq response empty");
        }
        return JSON.parse(content);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        lastError = new Error("Groq API request timed out");
      } else if (!lastError || err.status) {
        lastError = err;
      }

      // Don't retry non-retryable errors
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < MAX_RETRIES - 1) {
      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `Groq API attempt ${attempt + 1} failed. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error("Groq API failed after all retries");
};

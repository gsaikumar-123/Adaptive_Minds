const DEFAULT_TIMEOUT_MS = 3500;

const withTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const fetchDktForecast = async (payload) => {
  const baseUrl = process.env.ML_FORECAST_URL;
  if (!baseUrl) {
    return null;
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/forecast`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (process.env.ML_FORECAST_API_KEY) {
    headers["x-api-key"] = process.env.ML_FORECAST_API_KEY;
  }

  const response = await withTimeout(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    Number(process.env.ML_FORECAST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`ML forecast service failed (${response.status}): ${errBody}`);
  }

  return response.json();
};

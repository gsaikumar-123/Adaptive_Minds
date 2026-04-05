export const errorHandler = (err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(", ") });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate entry" });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === "production";

  const message = isProduction
    ? statusCode === 429
      ? "Too many requests. Please try again shortly."
      : "An unexpected error occurred"
    : err.message || "Server error";

  const payload = { error: message };

  if (!isProduction) {
    payload.statusCode = statusCode;
    payload.path = `${req.method} ${req.originalUrl}`;
  }

  res.status(statusCode).json(payload);
};

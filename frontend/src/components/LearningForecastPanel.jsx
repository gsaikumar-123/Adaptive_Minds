import { useEffect, useState } from "react";
import { fetchLearningForecast, fetchLearningForecastV2 } from "../services/api.js";

const badgeStyles = {
  "Priority Focus": "border-rose-500/40 bg-rose-500/10 text-rose-300",
  Reinforce: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  Maintain: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

export default function LearningForecastPanel({ domain }) {
  const [forecast, setForecast] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [source, setSource] = useState("baseline-only");
  const [warning, setWarning] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!domain) return;

    const loadForecast = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("token");
        const advanced = await fetchLearningForecastV2(domain, token);
        setForecast(advanced.effectiveForecast || advanced.baselineForecast || null);
        setComparison(advanced.comparison || null);
        setSource(advanced.source || "baseline-only");
        setWarning(advanced.warning || null);
      } catch (err) {
        try {
          const token = localStorage.getItem("token");
          const data = await fetchLearningForecast(domain, token);
          setForecast(data.forecast || null);
          setComparison(null);
          setSource("baseline-only");
          setWarning("Advanced forecast endpoint unavailable. Showing baseline model.");
        } catch (fallbackErr) {
          setError(fallbackErr.message || "Failed to load learning forecast");
        }
      } finally {
        setLoading(false);
      }
    };

    loadForecast();
  }, [domain]);

  if (!domain) return null;

  return (
    <section className="rounded-2xl border border-cyan-800/40 bg-slate-900/70 p-6 shadow-xl shadow-cyan-950/20">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-cyan-300">ML Learning Forecast</h3>
          <p className="text-sm text-slate-400">
            {source === "dkt-service"
              ? "Deep Knowledge Tracing + prerequisite re-ranking predicts what to study next."
              : "Local Bayesian Knowledge Tracing predicts your mastery and what to study next."}
          </p>
        </div>
        <span className="text-xs text-slate-500">
          {source === "dkt-service" ? "Advanced model active" : "Baseline model active"}
        </span>
      </div>

      {loading && <p className="text-sm text-slate-400">Training learner model from your attempts...</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {warning && <p className="mb-3 text-xs text-amber-300">{warning}</p>}

      {!loading && !error && forecast && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Readiness</p>
              <p className="mt-1 text-2xl font-bold text-cyan-300">{forecast.summary?.readinessScore ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg Mastery</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{forecast.summary?.averageMasteryScore ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{forecast.summary?.averageConfidence ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Evidence Events</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{forecast.summary?.totalEvidenceEvents ?? 0}</p>
            </div>
          </div>

          {comparison && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/10 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Readiness Delta</p>
                <p className="mt-1 text-xl font-bold text-cyan-300">
                  {comparison.readinessDelta >= 0 ? `+${comparison.readinessDelta}` : comparison.readinessDelta}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Priority Overlap</p>
                <p className="mt-1 text-xl font-bold text-slate-100">{comparison.priorityOverlapRate ?? 0}%</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Model Source</p>
                <p className="mt-1 text-xl font-bold text-slate-100">{source === "dkt-service" ? "DKT" : "BKT"}</p>
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-200">Top Priority Topics</h4>
            <div className="space-y-3">
              {(forecast.recommendations?.priorityNow || []).slice(0, 6).map((topicItem) => (
                <div key={`${topicItem.moduleName}-${topicItem.topic}`} className="rounded-xl border border-slate-700/70 bg-slate-800/40 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">{topicItem.topic}</p>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${badgeStyles[topicItem.recommendation] || "border-slate-600 text-slate-300"}`}>
                      {topicItem.recommendation}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Module: {topicItem.moduleName}</p>
                  <div className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                    <span>Mastery {topicItem.masteryScore}%</span>
                    <span>Confidence {topicItem.confidence}%</span>
                    <span>Priority {topicItem.priorityScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {forecast.policy && (
            <div className="rounded-xl border border-cyan-700/50 bg-cyan-950/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-cyan-200">Adaptive Study Policy</h4>
                <span className="text-xs text-cyan-300/80">{forecast.policy.algorithm}</span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Expected Gain</p>
                  <p className="mt-1 text-lg font-bold text-cyan-300">{forecast.policy.productivity?.expectedGainScore ?? 0}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Naive Days</p>
                  <p className="mt-1 text-lg font-bold text-slate-100">{forecast.policy.productivity?.naiveDays ?? 0}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Adaptive Days</p>
                  <p className="mt-1 text-lg font-bold text-slate-100">{forecast.policy.productivity?.adaptiveDays ?? 0}</p>
                </div>
                <div className="rounded-lg border border-emerald-600/50 bg-emerald-500/10 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-300/80">Estimated Days Saved</p>
                  <p className="mt-1 text-lg font-bold text-emerald-300">{forecast.policy.productivity?.estimatedDaysSaved ?? 0}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(forecast.policy.sessions || []).map((session) => (
                  <div key={session.day} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                      Day {session.day}: {session.focus}
                    </p>
                    <div className="mt-2 space-y-2">
                      {(session.topics || []).map((topicItem) => (
                        <div key={`${session.day}-${topicItem.topic}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                          <span className="font-medium text-slate-100">{topicItem.topic}</span>
                          <span>{topicItem.reason}</span>
                          <span className="text-cyan-300">gain +{topicItem.expectedGain}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h4 className="text-sm font-semibold text-slate-200">Model Notes</h4>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {(forecast.model?.notes || []).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

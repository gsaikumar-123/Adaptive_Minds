const meterColor = (score) => {
  if (score >= 75) return "from-emerald-500 to-emerald-300";
  if (score >= 50) return "from-amber-500 to-amber-300";
  return "from-rose-500 to-rose-300";
};

export default function SkillDnaPanel({ skillDna }) {
  if (!skillDna) return null;

  const modules = Array.isArray(skillDna.modules) ? skillDna.modules.slice(0, 8) : [];
  const overview = skillDna.overall || {
    weightedAccuracy: 0,
    consistency: 0,
    readinessScore: 0,
    totalQuestions: 0,
  };

  return (
    <div className="space-y-7 rounded-2xl border border-cyan-900/40 bg-slate-900/70 p-7 shadow-xl shadow-cyan-950/20 animate-slide-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-cyan-300">Skill DNA Signature</h3>
          <p className="mt-1 text-sm text-slate-400">
            Deterministic scoring model computed from your answer pattern, question difficulty, and module coverage.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {skillDna.modelVersion || "skill-dna-v1"}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-5 min-h-[118px]">
          <p className="text-xs uppercase tracking-wide text-slate-400">Weighted Accuracy</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{overview.weightedAccuracy}%</p>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-5 min-h-[118px]">
          <p className="text-xs uppercase tracking-wide text-slate-400">Consistency</p>
          <p className="mt-2 text-2xl font-bold text-slate-100">{overview.consistency}%</p>
        </div>
        <div className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-5 min-h-[118px]">
          <p className="text-xs uppercase tracking-wide text-slate-400">Readiness Score</p>
          <p className="mt-2 text-2xl font-bold text-cyan-300">{overview.readinessScore}%</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">Module Priority Ranking</h4>
          <span className="text-xs text-slate-500">Top {modules.length} modules</span>
        </div>

        <div className="space-y-4">
          {modules.length > 0 ? (
            modules.map((module) => (
              <div
                key={module.moduleName}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-slate-100">{module.moduleName}</h5>
                  <span className="rounded-md border border-slate-600 px-2 py-0.5 text-xs text-slate-300">
                    {module.recommendation}
                  </span>
                </div>

                <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                  <span>Mastery {module.masteryScore}%</span>
                  <span>Confidence {module.confidence}%</span>
                  <span>Priority {module.priorityIndex}</span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${meterColor(module.masteryScore)} transition-all duration-500`}
                    style={{ width: `${module.masteryScore}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm italic text-slate-400">No module-level data available.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5">
        <h4 className="text-sm font-semibold text-slate-200">How This Is Computed</h4>
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          {(skillDna.signature || []).map((item) => (
            <li key={item.label}>
              <span className="font-semibold text-slate-300">{item.label}:</span> {item.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

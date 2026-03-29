import SkillDnaPanel from "./SkillDnaPanel.jsx";

export default function ResultSummary({ result }) {
  if (!result) return null;

  const weakTopics = result.weakTopics || [];
  const masteredTopics = result.masteredTopics || [];
  const prerequisites = result.prerequisites || [];

  return (
    <div className="space-y-6">
      <SkillDnaPanel skillDna={result.skillDna} />

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl shadow-black/20 animate-slide-up">
        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Diagnostic Summary</h3>
        <p className="mt-3 text-base text-slate-300 leading-relaxed">{result.summary || "Assessment completed successfully."}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-rose-900/30 bg-slate-900/60 backdrop-blur-md p-6 shadow-lg hover:border-rose-500/30 transition-colors duration-300 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h4 className="text-base font-bold flex items-center gap-2 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse-slow"></span>
            Needs Review
          </h4>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {weakTopics.length > 0 ? (
              weakTopics.map((t, i) => (
                <li key={i} className="flex flex-col gap-1 pb-2 border-b border-slate-800/50 last:border-0 last:pb-0">
                  <span className="font-semibold text-slate-200">{t.topic}</span>
                  <span className="text-xs text-slate-400">{t.reason}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">No weak topics identified</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-emerald-900/30 bg-slate-900/60 backdrop-blur-md p-6 shadow-lg hover:border-emerald-500/30 transition-colors duration-300 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <h4 className="text-base font-bold flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Mastered
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {masteredTopics.length > 0 ? (
              masteredTopics.map((t, i) => (
                <li key={i} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  {t}
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">No mastered topics yet</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-900/30 bg-slate-900/60 backdrop-blur-md p-6 shadow-lg hover:border-amber-500/30 transition-colors duration-300 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h4 className="text-base font-bold flex items-center gap-2 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Prerequisites
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {prerequisites.length > 0 ? (
              prerequisites.map((t, i) => (
                <li key={i} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {t}
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">No prerequisites needed</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

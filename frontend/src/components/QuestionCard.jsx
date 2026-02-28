export default function QuestionCard({ index, question, selected, onSelect }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl shadow-black/20 animate-slide-up hover:border-slate-600/50 transition-colors duration-300">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-slate-400 mb-4">
        <span className="bg-slate-800/80 px-3 py-1 rounded-full text-slate-300">Question {index + 1}</span>
        <span className="uppercase text-cyan-400 bg-cyan-900/20 px-3 py-1 rounded-full">{question.difficulty}</span>
      </div>
      <p className="mt-2 text-lg text-slate-100 font-medium leading-relaxed">{question.prompt}</p>
      <div className="mt-6 space-y-3">
        {question.options.map((opt, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 text-sm transition-all duration-300 ${selected === i
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-[1.01]"
                : "border-slate-700/80 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100"
              }`}
          >
            <input
              type="radio"
              className="mt-0.5 appearance-none w-4 h-4 rounded-full border-2 border-slate-500 checked:border-emerald-500 checked:bg-emerald-500 transition-colors duration-200 cursor-pointer focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
              checked={selected === i}
              onChange={() => onSelect(question.id, i)}
            />
            <span className="flex-1 leading-snug">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

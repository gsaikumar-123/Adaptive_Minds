export default function DomainSelector({ domains, value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300 ml-1">Select Domain</label>
      <select
        className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 backdrop-blur-sm px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-500 transition-all duration-300 shadow-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" className="bg-slate-900">Choose a roadmap</option>
        {domains.map((d) => (
          <option key={d.id} value={d.id} className="bg-slate-900">
            {d.name || d.id}
          </option>
        ))}
      </select>
    </div>
  );
}

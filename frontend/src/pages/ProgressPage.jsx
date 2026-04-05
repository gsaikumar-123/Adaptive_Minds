import ProgressHeatmap from "../components/ProgressHeatmap.jsx";

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-6xl animate-fade-in w-full pb-16 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Progress</h1>
        <p className="text-slate-400">
          Track your daily completion streak and overall consistency across all roadmaps.
        </p>
      </header>

      <ProgressHeatmap />
    </div>
  );
}

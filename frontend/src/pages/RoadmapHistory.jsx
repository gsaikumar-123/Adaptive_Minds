import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fetchHistory } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function RoadmapHistory() {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const token = localStorage.getItem("token");
                const data = await fetchHistory(token);
                setHistory(data.history || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, []);


    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400 max-w-2xl mx-auto mt-10">
                <p className="font-semibold mb-2">Error loading history</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }


    return (
        <div className="mx-auto max-w-6xl animate-fade-in w-full pb-16 space-y-8">
            <header className="mb-12 space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">My Roadmaps</h1>
                <p className="text-slate-400">View and resume your previously generated learning paths.</p>
            </header>

            {history.length === 0 ? (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-12 text-center backdrop-blur-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-200">No roadmaps yet</h3>
                    <p className="mt-2 text-slate-400 mb-6">Start a new assessment to generate your first adaptive roadmap.</p>
                    <Link
                        to="/dashboard/new"
                        className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 transition-colors"
                    >
                        Create Roadmap
                    </Link>
                </div>
            ) : (
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                    {history.map((attempt) => {
                        const isCompleted = attempt.status === "completed" && attempt.roadmapId;
                        const CardWrapper = isCompleted ? Link : "div";
                        const wrapperProps = isCompleted ? { to: `/dashboard/roadmap/${attempt.roadmapId}` } : {};

                        return (
                            <CardWrapper
                                key={attempt.id}
                                {...wrapperProps}
                                className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-700/50 p-7 backdrop-blur-sm transition-all duration-300 ${isCompleted
                                    ? "bg-slate-800/30 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-900/20 cursor-pointer"
                                    : "bg-slate-900/50 opacity-75 cursor-not-allowed"
                                    }`}
                            >
                                <div className="space-y-3">
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                                            {attempt.domainName}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {format(new Date(attempt.date), "MMM d, yyyy")}
                                        </span>
                                    </div>
                                    <h3 className="mb-2 text-xl font-bold text-slate-200 line-clamp-2" title={attempt.goal}>
                                        Goal: {attempt.goal}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Status: <span className="capitalize">{attempt.status}</span>
                                    </p>
                                    {attempt.forecastSource && (
                                        <p className="mt-1 text-xs text-cyan-300/80">
                                            Forecast: {attempt.forecastSource === "dkt-service" ? "DKT" : "BKT"}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-6 flex items-center justify-end">
                                    {isCompleted ? (
                                        <div className="flex items-center gap-2 text-sm font-medium text-cyan-400 group-hover:text-cyan-300 transition-colors">
                                            View Roadmap
                                            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-medium text-slate-500">Incomplete</span>
                                    )}
                                </div>
                            </CardWrapper>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

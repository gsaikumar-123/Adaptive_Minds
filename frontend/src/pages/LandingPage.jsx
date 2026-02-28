import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Navigate } from "react-router-dom";

export default function LandingPage() {
    const { user, loading } = useAuth();

    if (loading) return null;
    if (user) return <Navigate to="/dashboard" />;

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 font-sans text-slate-100 overflow-hidden px-4">
            {/* Ambient glows */}
            <div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[150px] pointer-events-none animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] rounded-full bg-cyan-900/10 blur-[150px] pointer-events-none" />

            <main className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center text-center animate-fade-in">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    AI-Powered Adaptive Learning
                </div>

                <h1 className="mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                    Master any skill with a{" "}
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        personalized
                    </span>{" "}
                    roadmap.
                </h1>

                <p className="mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl">
                    Don't waste time on what you already know. Our engine assesses your current knowledge and builds a dynamic curriculum of tutorials, videos, and articles specifically tailored for you.
                </p>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <Link
                        to="/register"
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-4 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-300"
                    >
                        Start Learning for Free
                    </Link>
                    <Link
                        to="/login"
                        className="rounded-xl border border-slate-700 bg-slate-900/50 backdrop-blur-sm px-8 py-4 text-base font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-300"
                    >
                        Sign In
                    </Link>
                </div>

                {/* Feature Highlights */}
                <div className="mt-20 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-md">
                        <h3 className="mb-2 text-lg font-bold text-slate-200">Adaptive Assessments</h3>
                        <p className="text-sm text-slate-400">Prove what you know through dynamic MCQs, and skip straight to what you need to learn next.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-md">
                        <h3 className="mb-2 text-lg font-bold text-slate-200">Curated Resources</h3>
                        <p className="text-sm text-slate-400">Get the best YouTube videos and articles automatically mapped to your precise learning gaps.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 backdrop-blur-md">
                        <h3 className="mb-2 text-lg font-bold text-slate-200">Progress Tracking</h3>
                        <p className="text-sm text-slate-400">Save your roadmaps, check off topics, and watch your consistency grow on your learning heatmap.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

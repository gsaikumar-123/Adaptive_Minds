import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { registerUser } from "../services/api.js";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loadingState, setLoadingState] = useState(false);
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();

    if (!loading && user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        setLoadingState(true);

        try {
            const data = await registerUser(name, email, password);
            login(data.user, data.token);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingState(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-100 overflow-hidden px-4">
            {/* Ambient background glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none animate-pulse-slow" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />

            <div className="relative w-full max-w-md animate-fade-in z-10">
                <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                            Create Account
                        </h1>
                        <p className="text-sm text-slate-400 mt-2">Join to build and save personalized learning roadmaps.</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-5">
                        {error && (
                            <div className="rounded-lg bg-rose-500/10 border border-rose-500/50 p-3 text-sm text-rose-400 text-center animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 backdrop-blur-sm px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 shadow-inner"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 backdrop-blur-sm px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 shadow-inner"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/50 backdrop-blur-sm px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 shadow-inner"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loadingState}
                            className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-emerald-500 hover:shadow-xl hover:shadow-cyan-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:translate-y-0 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loadingState ? "Creating account..." : "Register"}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-400">
                        Already have an account?{" "}
                        <Link to="/login" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

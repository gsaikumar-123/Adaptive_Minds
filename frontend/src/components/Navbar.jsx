import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
    const { user, logout, loading } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                <Link to="/" className="flex items-center gap-2 transition-transform hover:scale-105 duration-300">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/20">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
                        Adaptive
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    {!loading && (user ? (
                        <>
                            <span className="text-sm font-medium text-slate-300 hidden sm:inline-block">
                                Welcome, {user.name}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/login"
                                className="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200"
                            >
                                Sign In
                            </Link>
                            <Link
                                to="/register"
                                className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-sm"
                            >
                                Get Started
                            </Link>
                        </>
                    ))}
                </div>
            </div>
        </nav>
    );
}

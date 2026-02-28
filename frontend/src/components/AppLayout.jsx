import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppLayout() {
    const { user, logout, refreshUser } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    // Refresh user data on mount to keep prompt usage in sync
    useEffect(() => {
        if (refreshUser) refreshUser();
    }, []);

    // Generate breadcrumbs based on the current path
    const pathnames = location.pathname.split("/").filter((x) => x);
    const breadcrumbs = pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;

        let name = decodeURIComponent(value);
        const isObjectId = /^[a-f\d]{24}$/i.test(name);

        if (isObjectId) {
            name = "Details";
        } else {
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        let displayName = name;

        if (name === "Dashboard") displayName = "My Roadmaps";
        if (name === "New") displayName = "Generator";

        const isLast = index === pathnames.length - 1;

        // Render intermediate paths as text instead of links so users don't go to blank index routes
        const isUnclickablePath = value === "roadmap" || value === "resources";

        return (
            <li key={to} className="flex items-center">
                <span className="mx-2 text-slate-500">/</span>
                {isLast ? (
                    <span className="text-emerald-400 font-medium" aria-current="page">
                        {displayName}
                    </span>
                ) : isUnclickablePath ? (
                    <span className="text-slate-400 font-medium cursor-default">
                        {displayName}
                    </span>
                ) : (
                    <Link to={to} className="text-slate-400 hover:text-slate-200 transition-colors">
                        {displayName}
                    </Link>
                )}
            </li>
        );
    });

    // Calculate remaining prompts (defaults to 3 if user.promptUsage doesn't exist yet)
    // We'll update this once the backend sends prompt tracker in getMe
    const usedPrompts = user?.promptUsage?.count || 0;
    let remainingPrompts = 3 - usedPrompts;
    if (remainingPrompts < 0) remainingPrompts = 0;

    // If the lastReset is not today (in IST), override to 3
    if (user?.promptUsage?.lastReset) {
        const getISTDate = (dateString = null) => {
            const date = dateString ? new Date(dateString) : new Date();
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
        };
        const todayIST = getISTDate();
        const resetIST = getISTDate(user.promptUsage.lastReset);

        if (todayIST !== resetIST) {
            remainingPrompts = 3;
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 relative">
            {/* Ambient background glows for the whole dashboard */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none animate-pulse-slow z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-cyan-900/5 blur-[120px] pointer-events-none z-0" />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-800 bg-slate-900/80 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    } flex flex-col`}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-800/60">
                    <Link to="/dashboard" onClick={closeSidebar} className="flex items-center gap-2 group">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                            Adaptive
                        </span>
                    </Link>
                    <button onClick={closeSidebar} className="lg:hidden text-slate-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 space-y-2 p-4 mt-2">
                    <Link
                        to="/dashboard"
                        onClick={closeSidebar}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${location.pathname === "/dashboard"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="font-medium">My Roadmaps</span>
                    </Link>
                    <Link
                        to="/dashboard/new"
                        onClick={closeSidebar}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${location.pathname.includes("/dashboard/new")
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="font-medium">Generator</span>
                    </Link>
                </nav>

                {/* Prompt Usage Tracker */}
                <div className="p-4 mx-4 mb-4 rounded-xl border border-slate-800 bg-slate-950/50 shadow-inner">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Daily Prompt Limit</h4>
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-300">Remaining Today:</span>
                        <span className={`font-bold ${remainingPrompts > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {remainingPrompts} / 3
                        </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${remainingPrompts === 0 ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-500'}`}
                            style={{ width: `${(remainingPrompts / 3) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* User Footer */}
                <div className="border-t border-slate-800/60 p-4">
                    <div className="flex items-center gap-3 px-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold uppercase">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden z-10 relative">
                {/* Header with Hamburger & Breadcrumbs */}
                <header className="flex h-16 items-center border-b border-slate-800/60 bg-slate-900/60 backdrop-blur-lg px-4 lg:px-8">
                    <button
                        onClick={toggleSidebar}
                        className="mr-4 lg:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Breadcrumb Trail */}
                    <nav className="flex" aria-label="Breadcrumb">
                        <ol className="inline-flex items-center space-x-1 md:space-x-3">
                            {breadcrumbs}
                        </ol>
                    </nav>
                </header>

                {/* Dynamic Page Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

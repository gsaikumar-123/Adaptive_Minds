import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Play, ExternalLink, BookOpen, Video } from "lucide-react";
import { fetchResources } from "../services/api.js";

export default function TopicResourcesPage() {
    const { topic } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const roadmapId = location.state?.roadmapId;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const handleBack = () => {
        if (roadmapId) {
            navigate(`/dashboard/roadmap/${roadmapId}`);
        } else {
            navigate("/dashboard");
        }
    };

    useEffect(() => {
        async function loadResources() {
            try {
                setLoading(true);
                const token = localStorage.getItem("token");
                const query = topic + " tutorial for beginners";
                const json = await fetchResources(query, topic, token);
                setData(json);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        if (topic) loadResources();
    }, [topic]);

    return (
        <div className="mx-auto max-w-6xl px-6 py-10 lg:p-12 relative z-10 animate-fade-in">
            <button
                onClick={handleBack}
                className="group flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors mb-8"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Roadmap
            </button>

            <header className="mb-10 animate-slide-up">
                <h1 className="text-3xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-md capitalize">
                    {decodeURIComponent(topic)}
                </h1>
                <p className="text-slate-400 mt-3 text-lg">Curated videos and articles to master this topic.</p>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-emerald-500 animate-pulse">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin mb-4" />
                    <p className="font-medium">Curating resources...</p>
                </div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl">
                    <p className="font-semibold text-lg">Oops! Something went wrong.</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-10">

                    {/* YouTube Videos Section */}
                    <section className="space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                            <div className="p-2 bg-rose-500/20 rounded-lg">
                                <Video className="w-5 h-5 text-rose-500" />
                            </div>
                            <h2 className="text-2xl font-semibold text-slate-100">Video Tutorials</h2>
                        </div>

                        <div className="grid gap-6">
                            {data?.videos?.length > 0 ? data.videos.map((video) => (
                                <div key={video.id} className="group flex flex-col sm:flex-row gap-4 bg-slate-800/20 border border-slate-700/50 hover:border-emerald-500/50 rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-900/10 hover:-translate-y-1">
                                    <div className="relative sm:w-48 shrink-0 overflow-hidden">
                                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover aspect-video group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center">
                                                <Play className="w-5 h-5 ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 sm:p-5 sm:pl-0 flex flex-col justify-center flex-1">
                                        <h3 className="text-base font-medium text-slate-100 line-clamp-2 leading-tight group-hover:text-emerald-300 transition-colors">
                                            {video.title}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                                            <span className="font-medium text-slate-300">{video.author}</span>
                                            <span>•</span>
                                            <span>{video.timestamp}</span>
                                        </div>
                                        <a
                                            href={video.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 w-fit"
                                        >
                                            Watch on YouTube <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-slate-500 text-sm italic">No videos found for this topic.</p>
                            )}
                        </div>
                    </section>

                    {/* Web Articles Section */}
                    <section className="space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                            <div className="p-2 bg-cyan-500/20 rounded-lg">
                                <BookOpen className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h2 className="text-2xl font-semibold text-slate-100">Articles & Docs</h2>
                        </div>

                        <div className="grid gap-4">
                            {data?.articles?.length > 0 ? data.articles.map((article, i) => (
                                <a
                                    key={i}
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block p-5 rounded-2xl bg-slate-800/20 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-slate-800/40 backdrop-blur-xl transition-all duration-300 hover:shadow-lg hover:shadow-cyan-900/10 hover:-translate-y-1"
                                >
                                    <h3 className="text-base font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors mb-2">
                                        {article.title}
                                    </h3>
                                    <p className="text-sm text-slate-400 line-clamp-2">
                                        {article.description}
                                    </p>
                                    <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-cyan-500 group-hover:text-cyan-400">
                                        Read article <ExternalLink className="w-3 h-3" />
                                    </div>
                                </a>
                            )) : (
                                <p className="text-slate-500 text-sm italic">No articles found for this topic.</p>
                            )}
                        </div>
                    </section>

                </div>
            )}
        </div>
    );
}

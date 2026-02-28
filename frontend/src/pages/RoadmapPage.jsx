import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchGeneratedRoadmap } from "../services/api.js";
import RoadmapPreview from "../components/RoadmapPreview.jsx";
import { ArrowLeft } from "lucide-react";

export default function RoadmapPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [roadmap, setRoadmap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadRoadmap = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const token = localStorage.getItem("token");
                const data = await fetchGeneratedRoadmap(id, token);
                setRoadmap(data.roadmap);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadRoadmap();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto max-w-2xl mt-10 rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
                <p className="font-semibold mb-2">Error loading roadmap</p>
                <p className="text-sm">{error}</p>
                <button
                    onClick={() => navigate("/dashboard")}
                    className="mt-6 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-500/30 transition-colors"
                >
                    Back to History
                </button>
            </div>
        );
    }

    if (!roadmap) {
        return null; // Should ideally also have a "Not Found" state
    }

    return (
        <div className="mx-auto max-w-6xl animate-fade-in pb-16 relative z-10 w-full">
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={() => navigate("/dashboard")}
                    className="group flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to History
                </button>
            </div>

            <RoadmapPreview roadmap={roadmap} />
        </div>
    );
}

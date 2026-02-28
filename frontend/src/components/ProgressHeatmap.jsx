import React, { useEffect, useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { subDays } from "date-fns";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchHeatmapData } from "../services/api.js";

export default function ProgressHeatmap() {
    const { user } = useAuth();
    const [heatmapData, setHeatmapData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const loadHeatmap = async () => {
            try {
                const token = localStorage.getItem("token");
                const data = await fetchHeatmapData(token);
                setHeatmapData(data);
            } catch (err) {
                console.error("Error fetching heatmap:", err);
            } finally {
                setLoading(false);
            }
        };

        loadHeatmap();
    }, [user]);

    if (!user) return null;

    const today = new Date();
    const startDate = subDays(today, 120); // Show last 4 months roughly

    const getClassForValue = (value) => {
        if (!value || value.count === 0) {
            return "fill-slate-800/50";
        }
        if (value.count === 1) return "fill-emerald-900/50";
        if (value.count === 2) return "fill-emerald-700/60";
        if (value.count === 3) return "fill-emerald-500/80";
        return "fill-emerald-400";
    };

    return (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl w-full mx-auto max-w-4xl mt-8 animate-slide-up">
            <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Learning Consistency
                </h3>
                <span className="text-sm font-medium text-slate-400">Past 4 Months</span>
            </div>

            {loading ? (
                <div className="h-24 flex items-center justify-center text-slate-500 animate-pulse">
                    Loading heatmap...
                </div>
            ) : (
                <div className="overflow-x-auto pb-2 heatmap-container">
                    <CalendarHeatmap
                        startDate={startDate}
                        endDate={today}
                        values={heatmapData}
                        classForValue={getClassForValue}
                        titleForValue={(value) => {
                            if (!value) return "No topics completed";
                            return `${value.count} topic(s) completed on ${value.date}`;
                        }}
                        showWeekdayLabels={true}
                    />
                </div>
            )}
            <style>{`
        .heatmap-container .react-calendar-heatmap text {
          fill: #94a3b8; /* text-slate-400 */
          font-size: 8px;
        }
        .heatmap-container rect {
          rx: 2; /* slight rounding on squares */
          ry: 2;
        }
      `}</style>
        </div>
    );
}

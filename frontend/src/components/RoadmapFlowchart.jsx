import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCompletedTopics, toggleTopicCompletion } from "../services/api.js";
import ProgressHeatmap from "./ProgressHeatmap.jsx";
import LearningForecastPanel from "./LearningForecastPanel.jsx";

export default function RoadmapFlowchart({ roadmap }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [completedTopics, setCompletedTopics] = useState([]);

  useEffect(() => {
    if (!user || !roadmap?.domain) return;

    const loadCompleted = async () => {
      try {
        const token = localStorage.getItem("token");
        const data = await fetchCompletedTopics(roadmap.domain, token);
        setCompletedTopics(data.completedTopics || []);
      } catch (err) {
        console.error("Failed to fetch completed topics", err);
      }
    };

    loadCompleted();
  }, [user, roadmap?.domain]);

  if (!roadmap || !roadmap.modules) return null;

  const modules = Array.isArray(roadmap.modules) ? roadmap.modules : [];

  const handleToggleComplete = async (topic) => {
    if (!user) {
      navigate("/login");
      return;
    }

    const isCompleted = completedTopics.includes(topic);

    // Optimistic UI update
    setCompletedTopics(prev =>
      isCompleted ? prev.filter(t => t !== topic) : [...prev, topic]
    );

    try {
      const token = localStorage.getItem("token");
      await toggleTopicCompletion(topic, roadmap.domain, !isCompleted, token);
    } catch (err) {
      console.error("Failed to toggle progress", err);
      // Revert on error
      setCompletedTopics(prev =>
        isCompleted ? [...prev, topic] : prev.filter(t => t !== topic)
      );
    }
  };

  const download = () => {
    const blob = new Blob([roadmap.csv || ""], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roadmap.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl w-full mx-auto max-w-4xl mt-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-slate-100">Your Learning Roadmap</h3>
          <button
            onClick={download}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 transition"
          >
            Download CSV
          </button>
        </div>
        <p className="text-slate-400 italic">No roadmap data available</p>
      </div>
    );
  }

  // Calculate total progress
  const totalTopics = modules.reduce((acc, mod) => acc + (mod.topics ? mod.topics.length : 0), 0);
  const totalCompleted = completedTopics.length;
  const overallProgress = totalTopics === 0 ? 0 : Math.round((totalCompleted / totalTopics) * 100);

  return (
    <>
      {user && <ProgressHeatmap />}
      {user && roadmap?.domain && <LearningForecastPanel domain={roadmap.domain} />}

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl w-full mx-auto max-w-4xl mt-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Your Learning Roadmap
            </h3>
            {user && (
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
                <span>Overall Progress:</span>
                <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <span className="font-semibold text-emerald-400">{overallProgress}%</span>
              </div>
            )}
          </div>

          <button
            onClick={download}
            className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-300"
          >
            Export CSV
          </button>
        </div>

        <div className="relative">
          <div className="space-y-8">
            {modules.map((module, index) => {
              const topics = Array.isArray(module.topics) ? module.topics : [];
              const moduleCompletedTopics = topics.filter(t => completedTopics.includes(t)).length;
              const moduleProgress = topics.length === 0 ? 0 : Math.round((moduleCompletedTopics / topics.length) * 100);

              return (
                <div key={index} className="relative group">
                  {/* Connector line from previous module */}
                  {index > 0 && (
                    <div className="absolute left-8 -top-8 w-0.5 h-8 bg-gradient-to-b from-slate-700 to-slate-800" />
                  )}

                  {/* Module card */}
                  <div className="relative flex gap-5">
                    {/* Module number badge */}
                    <div className="flex-shrink-0 z-10">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors duration-500 ${moduleProgress === 100
                        ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-emerald-500/30 text-slate-950'
                        : 'bg-slate-800 border-2 border-slate-700 text-slate-300 group-hover:border-emerald-500/50 group-hover:text-emerald-400'
                        }`}>
                        {moduleProgress === 100 ? (
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-xl font-bold">{index + 1}</span>
                        )}
                      </div>
                    </div>

                    {/* Module content */}
                    <div className="flex-1 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 shadow-md hover:border-slate-600 transition-colors duration-300">
                      <h4 className="text-xl font-bold text-slate-100 mb-4 tracking-tight">
                        {module.moduleName || "Unnamed Module"}
                      </h4>

                      {/* Topics list */}
                      <div className="space-y-2">
                        {topics.length > 0 ? (
                          topics.map((topic, topicIdx) => {
                            const isDone = completedTopics.includes(topic);
                            return (
                              <div
                                key={topicIdx}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${isDone
                                  ? 'border-emerald-500/20 bg-emerald-500/5 shadow-inner'
                                  : 'border-slate-800 bg-slate-800/30 hover:bg-slate-800 hover:border-slate-700'
                                  }`}
                              >
                                <button
                                  onClick={() => navigate(`/dashboard/resources/${encodeURIComponent(topic)}`, { state: { roadmapId: roadmap.id } })}
                                  className={`flex-1 text-left text-sm font-medium transition-colors ${isDone ? 'text-emerald-300 line-through opacity-70' : 'text-slate-200 hover:text-cyan-400'
                                    }`}
                                >
                                  {topic}
                                </button>

                                <button
                                  onClick={() => handleToggleComplete(topic)}
                                  className={`ml-4 flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${isDone
                                    ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                    : 'border-slate-600 text-transparent hover:border-emerald-400 hover:bg-emerald-400/10'
                                    }`}
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500 italic px-2">No specific topics defined.</p>
                        )}
                      </div>

                      {/* Progress bar for module */}
                      <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-slate-500">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                            style={{ width: `${moduleProgress}%` }}
                          />
                        </div>
                        <span>{moduleCompletedTopics} / {topics.length} complete</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Completion badge */}
          {overallProgress === 100 && modules.length > 0 && (
            <div className="mt-12 flex justify-center animate-bounce-slow">
              <div className="rounded-full border border-emerald-500/50 bg-emerald-950/40 backdrop-blur-md px-8 py-4 flex items-center gap-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-emerald-400">Domain Mastered!</h4>
                  <p className="text-sm text-emerald-500/80">You've completed all modules.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

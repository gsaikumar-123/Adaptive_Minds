import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import DomainSelector from "./components/DomainSelector.jsx";
import GoalInput from "./components/GoalInput.jsx";
import QuestionCard from "./components/QuestionCard.jsx";
import ResultSummary from "./components/ResultSummary.jsx";
import RoadmapPreview from "./components/RoadmapPreview.jsx";
import Navbar from "./components/Navbar.jsx";
import { useAssessment } from "./state/useAssessment.js";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

const TopicResourcesPage = lazy(() => import("./pages/TopicResourcesPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const RoadmapHistory = lazy(() => import("./pages/RoadmapHistory.jsx"));
const RoadmapPage = lazy(() => import("./pages/RoadmapPage.jsx"));
const AppLayout = lazy(() => import("./components/AppLayout.jsx"));

function PageLoader() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
    </div>
  );
}

function AssessmentPage() {
  const {
    domains,
    loading,
    error,
    attempt,
    questions,
    answers,
    result,
    loadDomains,
    beginAssessment,
    selectAnswer,
    submit,
    skip
  } = useAssessment();

  const [domainId, setDomainId] = useState("");
  const [goal, setGoal] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadDomains();
  }, []);

  const start = () => {
    if (!domainId || goal.trim().length < 5) return;
    setSubmitted(false);
    beginAssessment({ domainId, goal });
  };

  const handleSkip = () => {
    if (!domainId) return;
    skip(domainId);
  };

  const handleSubmit = () => {
    if (submitted || loading) return;
    setSubmitted(true);
    submit();
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-6xl relative z-10 animate-fade-in w-full pb-16">
      <header className="space-y-3 mb-10">
        <p className="text-sm font-medium tracking-wide text-emerald-400">Assessment</p>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white drop-shadow-md">
          Personalized Roadmap Generator
        </h1>
        <p className="text-base text-slate-400 max-w-2xl">
          Explain your learning goal and take an adaptive assessment to receive a tailored curriculum.
        </p>
      </header>

      <section className="grid gap-8 rounded-3xl border border-slate-700/50 bg-slate-800/20 backdrop-blur-xl p-8 lg:grid-cols-2 shadow-xl shadow-emerald-900/10">
        <DomainSelector domains={domains} value={domainId} onChange={setDomainId} />
        <GoalInput value={goal} onChange={setGoal} />
        <div className="lg:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-sm text-slate-400 flex-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
            {attempt?.intent?.intentSummary || "Select a domain and enter your goal to begin."}
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={handleSkip}
              disabled={!domainId || loading}
              className="flex-1 md:flex-none rounded-xl bg-slate-800/80 border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50 transition-all duration-300 ease-out shadow-sm"
            >
              Skip Assessment
            </button>
            <button
              onClick={start}
              disabled={loading || !domainId || goal.trim().length < 5}
              className="flex-1 md:flex-none rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 hover:from-emerald-400 hover:to-emerald-300 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all duration-300 ease-out"
            >
              {loading ? "Preparing..." : "Start Assessment"}
            </button>
          </div>
        </div>
        {error && (
          <div className="lg:col-span-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
      </section>

      {questions.length > 0 && (
        <section className="mt-12 space-y-6 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-100">Adaptive MCQ Assessment</h2>
            <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sm font-medium text-emerald-400">
              Answered {answeredCount}/{questions.length}
            </div>
          </div>
          <div className="grid gap-5">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                index={i}
                question={q}
                selected={answers[q.id]}
                onSelect={selectAnswer}
              />
            ))}
          </div>
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={loading || submitted || answeredCount !== questions.length}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-8 py-3 text-base font-bold text-slate-950 hover:from-cyan-400 hover:to-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-300 ease-out"
            >
              {loading ? "Evaluating..." : submitted ? "Submitted" : "Submit Assessment"}
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="mt-16 space-y-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <ResultSummary result={result} />
          <RoadmapPreview roadmap={result.roadmap} />
        </section>
      )}
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans flex flex-col">
        {!isDashboard && (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none animate-pulse-slow z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none z-0" />
          </>
        )}

        {!isDashboard && <Navbar />}

        <main className={`flex-1 relative z-10 w-full flex flex-col ${isDashboard ? 'h-full' : ''}`}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route path="/dashboard" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<RoadmapHistory />} />
                <Route path="new" element={<AssessmentPage />} />
                <Route path="roadmap/:id" element={<RoadmapPage />} />
                <Route path="resources/:topic" element={<TopicResourcesPage />} />
              </Route>
            </Routes>
          </Suspense>
        </main>
      </div>
    </AuthProvider>
  );
}

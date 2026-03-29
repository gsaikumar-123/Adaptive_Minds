import { useState } from "react";
import { fetchDomains, startAssessment, submitAssessment, skipAssessment } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export const useAssessment = () => {
  const { refreshUser } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [selectorMeta, setSelectorMeta] = useState(null);

  const loadDomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDomains();
      setDomains(data.domains);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const beginAssessment = async ({ domainId, goal }) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const data = await startAssessment({ domainId, goal }, token);
      setAttempt({
        id: data.attemptId,
        intent: data.intent,
        round: data.round || 1,
        progress: data.progress || null,
      });
      setQuestions(data.questions);
      setAnswers({});
      setResult(null);
      setSelectorMeta(data.selector || null);
      if (refreshUser) refreshUser(); // sync prompt limits async
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionId, selectedIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selectedIndex }));
  };

  const submit = async () => {
    if (!attempt?.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        attemptId: attempt.id,
        answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
          questionId,
          selectedIndex
        }))
      };
      const data = await submitAssessment(payload, token);

      if (data.status === "in_progress") {
        setAttempt((prev) => ({
          ...(prev || {}),
          id: data.attemptId || prev?.id,
          round: data.round || (prev?.round || 1),
          progress: data.progress || prev?.progress || null,
        }));
        setQuestions(data.questions || []);
        setAnswers({});
        setSelectorMeta(data.selector || null);
        return;
      }

      setSelectorMeta(data.selector || null);
      setQuestions([]);
      setAnswers({});
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const skip = async (domainId) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const data = await skipAssessment(domainId, token);
      // Normalize the response to ensure consistent structure
      const normalizedResult = {
        roadmap: data.roadmap || {
          id: domainId,
          modules: [],
          csv: ""
        },
        summary: "Full roadmap loaded",
        weakTopics: [],
        masteredTopics: [],
        prerequisites: [],
        status: "completed",
      };
      setResult(normalizedResult);
      setQuestions([]);
      setAttempt(null);
      setSelectorMeta(null);
      if (refreshUser) refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    domains,
    loading,
    error,
    attempt,
    questions,
    answers,
    result,
    selectorMeta,
    loadDomains,
    beginAssessment,
    selectAnswer,
    submit,
    skip
  };
};

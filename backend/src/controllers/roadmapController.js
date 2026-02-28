import { loadRoadmaps, getRoadmapById } from "../services/roadmapLoader.js";

export const listDomains = (req, res) => {
  const roadmaps = loadRoadmaps();
  const domains = roadmaps.map((r) => ({ id: r.id, name: r.name, file: r.file }));
  res.json({ domains });
};

export const getRoadmap = (req, res) => {
  const roadmap = getRoadmapById(req.params.domainId);
  if (!roadmap) {
    return res.status(404).json({ error: "Domain not found" });
  }
  res.json({ roadmap });
};

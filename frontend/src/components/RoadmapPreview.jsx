import RoadmapFlowchart from "./RoadmapFlowchart.jsx";

export default function RoadmapPreview({ roadmap }) {
  if (!roadmap) return null;

  return <RoadmapFlowchart roadmap={roadmap} />;
}

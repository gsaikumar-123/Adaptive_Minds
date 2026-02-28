import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve relative to this file's location, not the working directory
const ROADMAP_DIR = path.resolve(__dirname, "..", "..", "data", "roadmaps");
let roadmapCache = null;

export const loadRoadmaps = () => {
  if (roadmapCache) return roadmapCache;

  const files = fs.readdirSync(ROADMAP_DIR).filter((f) => f.endsWith(".csv"));
  const roadmaps = files.map((file) => {
    const csv = fs.readFileSync(path.join(ROADMAP_DIR, file), "utf-8");
    const records = parse(csv, { columns: true, skip_empty_lines: true });

    const id = file.replace("-roadmap.csv", "");
    const name = id
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      id,
      name,
      file,
      modules: records.map((row) => ({
        moduleName: row["Module Name"],
        topics: row["Module Contents"]
          ? row["Module Contents"].split(";").map((t) => t.trim()).filter(Boolean)
          : []
      }))
    };
  });

  roadmapCache = roadmaps;
  return roadmaps;
};

export const getRoadmapById = (id) => {
  const roadmaps = loadRoadmaps();
  return roadmaps.find((r) => r.id === id);
};

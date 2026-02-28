import express from "express";
import { completeTopic, getCompletedTopics, getHeatmapData, uncompleteTopic } from "../controllers/progressController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/complete", verifyToken, completeTopic);
router.post("/uncomplete", verifyToken, uncompleteTopic);
router.get("/completed", verifyToken, getCompletedTopics);
router.get("/heatmap", verifyToken, getHeatmapData);

export default router;

import express from "express";
import { completeTopic, getCompletedTopics, getHeatmapData, getLearningForecast, getLearningForecastV2, uncompleteTopic } from "../controllers/progressController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/complete", verifyToken, completeTopic);
router.post("/uncomplete", verifyToken, uncompleteTopic);
router.get("/completed", verifyToken, getCompletedTopics);
router.get("/heatmap", verifyToken, getHeatmapData);
router.get("/forecast", verifyToken, getLearningForecast);
router.get("/forecast-v2", verifyToken, getLearningForecastV2);

export default router;

import { Router } from "express";
import { startAssessment, submitAssessment, getOriginalRoadmap, getHistory, getGeneratedRoadmap } from "../controllers/assessmentController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

router.post("/start", verifyToken, startAssessment);
router.post("/submit", verifyToken, submitAssessment);
router.get("/skip/:domainId", verifyToken, getOriginalRoadmap);
router.get("/history", verifyToken, getHistory);
router.get("/roadmap/:id", verifyToken, getGeneratedRoadmap);

export default router;

import { Router } from "express";
import { listDomains, getRoadmap } from "../controllers/roadmapController.js";

const router = Router();

router.get("/domains", listDomains);
router.get("/:domainId", getRoadmap);

export default router;

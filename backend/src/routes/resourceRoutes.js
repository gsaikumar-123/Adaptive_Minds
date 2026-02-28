import express from "express";
import { getResources } from "../controllers/resourceController.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", verifyToken, getResources);

export default router;

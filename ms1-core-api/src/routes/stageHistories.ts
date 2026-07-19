import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createStageHistory,
  getStageHistoryById,
  updateStageHistory,
  listStageHistories,
} from "../repositories/stageHistoryRepository";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const histories = await listStageHistories(limit, offset);
    res.json(histories);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const history = await getStageHistoryById(req.params.id as string);
    if (!history) return res.status(404).json({ error: "Stage History not found" });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const history = await createStageHistory(req.body);
    res.status(201).json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const history = await updateStageHistory(req.params.id as string, req.body);
    if (!history) return res.status(404).json({ error: "Stage History not found" });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

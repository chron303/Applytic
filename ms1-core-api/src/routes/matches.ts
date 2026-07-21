import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import {
  createMatch,
  getMatchById,
  updateMatch,
  listMatches,
  getMatchesByUserId,
} from "../repositories/matchRepository";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const matches = await getMatchesByUserId(req.user!.userId, limit, offset);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const match = await getMatchById(req.params.id as string);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const match = await createMatch(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const match = await updateMatch(req.params.id as string, req.body);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

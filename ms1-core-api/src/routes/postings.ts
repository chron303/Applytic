import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createPosting,
  getPostingById,
  updatePosting,
  listPostings,
} from "../repositories/postingRepository";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const postings = await listPostings(limit, offset, status);
    res.json(postings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const posting = await getPostingById(req.params.id as string);
    if (!posting) return res.status(404).json({ error: "Posting not found" });
    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const posting = await createPosting(req.body);
    res.status(201).json(posting);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const posting = await updatePosting(req.params.id as string, req.body);
    if (!posting) return res.status(404).json({ error: "Posting not found" });
    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

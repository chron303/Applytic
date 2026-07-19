import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createRequirement,
  getRequirementById,
  updateRequirement,
  listRequirements,
  getRequirementsByPostingId,
} from "../repositories/requirementRepository";

const router = Router();

router.get("/", async (req, res) => {
  try {
    if (req.query.posting_id) {
      const requirements = await getRequirementsByPostingId(req.query.posting_id as string);
      res.json(requirements);
      return;
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const requirements = await listRequirements(limit, offset);
    res.json(requirements);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const requirement = await getRequirementById(req.params.id as string);
    if (!requirement) return res.status(404).json({ error: "Requirement not found" });
    res.json(requirement);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const requirement = await createRequirement(req.body);
    res.status(201).json(requirement);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const requirement = await updateRequirement(req.params.id as string, req.body);
    if (!requirement) return res.status(404).json({ error: "Requirement not found" });
    res.json(requirement);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

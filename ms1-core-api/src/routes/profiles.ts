import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createProfile,
  getProfileByUserId,
  updateProfile,
  listProfiles,
} from "../repositories/profileRepository";

const router = Router();

// Admin-only route: List all profiles
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const profiles = await listProfiles(limit, offset);
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileByUserId(req.params.id as string);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const profile = await createProfile(req.body);
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const profile = await updateProfile(req.params.id as string, req.body);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

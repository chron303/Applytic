import { Router } from "express";
import { requireInternalAuth } from "../middleware/auth";
import { createRequirement } from "../repositories/requirementRepository";
import { createMatch, getMatchById } from "../repositories/matchRepository";
import { createApplication } from "../repositories/applicationRepository";
import { getProfileByUserId } from "../repositories/profileRepository";

console.log(">>> internal.ts loaded <<<");

const router = Router();

router.use((req, res, next) => {
  console.log(`[INTERNAL] ${req.method} ${req.originalUrl}`);
  next();
});

router.use(requireInternalAuth);

router.post("/requirements", async (req, res) => {
  console.log(">>> /internal/requirements HIT <<<");

  try {
    console.log("Incoming requirement body:");
    console.dir(req.body, { depth: null });

    const reqData = await createRequirement(req.body);

    res.status(201).json(reqData);
  } catch (err) {
    console.error("createRequirement failed:");
    console.error(err);

    res.status(500).json({
      error: (err as Error).message,
    });
  }
});

router.post("/matches", async (req, res) => {
  console.log(">>> /internal/matches HIT <<<");

  try {
    console.log("Incoming match body:");
    console.dir(req.body, { depth: null });

    const matchData = await createMatch(req.body);

    console.log("Match inserted successfully:");
    console.dir(matchData, { depth: null });

    res.status(201).json(matchData);
  } catch (err) {
    console.error("createMatch failed:");
    console.error(err);

    res.status(500).json({
      error: (err as Error).message,
    });
  }
});

router.get("/matches/:id", async (req, res) => {
  console.log(`>>> /internal/matches/${req.params.id} HIT <<<`);
  
  try {
    const matchData = await getMatchById(req.params.id);
    if (!matchData) return res.status(404).json({ error: "Match not found" });
    res.json(matchData);
  } catch (err) {
    console.error("getMatchById failed:");
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/profiles/:userId", async (req, res) => {
  console.log(`>>> /internal/profiles/${req.params.userId} HIT <<<`);
  try {
    const profile = await getProfileByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/applications", async (req, res) => {
  console.log(">>> /internal/applications HIT <<<");

  try {
    console.log("Incoming application body:");
    console.dir(req.body, { depth: null });

    const appData = await createApplication(req.body);

    res.status(201).json(appData);
  } catch (err) {
    console.error("createApplication failed:");
    console.error(err);

    res.status(500).json({
      error: (err as Error).message,
    });
  }
});

export default router;
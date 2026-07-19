import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createApplication,
  getApplicationById,
  updateApplication,
  listApplications,
} from "../repositories/applicationRepository";
import { AuthenticatedRequest } from "../middleware/auth";
import { createStageHistory } from "../repositories/stageHistoryRepository";
import { sendEmail } from "../services/email.service";
import { pool } from "../db";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.userId;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const applications = await listApplications(userId, status, limit, offset);
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const application = await getApplicationById(req.params.id as string);
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const application = await createApplication(req.body);
    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const application = await updateApplication(req.params.id as string, req.body);
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const application = await updateApplication(req.params.id as string, req.body);
    if (!application) return res.status(404).json({ error: "Application not found" });
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/:id/approve", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const appId = req.params.id as string;
    
    const app = await getApplicationById(appId);
    if (!app) return res.status(404).json({ error: "Application not found" });

    const updatedApp = await updateApplication(appId, {
      status: "submitted",
      submitted_at: new Date()
    });

    await createStageHistory({
      application_id: appId,
      from_status: app.status,
      to_status: "submitted",
      changed_by: userId,
      notes: "User approved the drafted application",
      changed_at: new Date()
    });

    const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    const userEmail = userResult.rows[0]?.email;

    if (userEmail) {
      await sendEmail(
        userEmail,
        "Application Submitted",
        "<p>Your application has been successfully approved and submitted.</p>"
      ).catch(e => console.error("SES error:", e));
    }

    res.json(updatedApp);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

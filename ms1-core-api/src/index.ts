import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";
import authRouter from "./routes/auth";
import resumeRouter from "./routes/resume";
import profilesRouter from "./routes/profiles";
import postingsRouter from "./routes/postings";
import requirementsRouter from "./routes/requirements";
import matchesRouter from "./routes/matches";
import applicationsRouter from "./routes/applications";
import stageHistoriesRouter from "./routes/stageHistories";
import internalRouter from "./routes/internal";
import draftRouter from "./routes/draft";
import dashboardRouter from "./routes/dashboard";
import { requireAuth, requireRole, AuthenticatedRequest } from "./middleware/auth";
import testEmailRouter from "./routes/testEmail";
dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/auth", authRouter);
app.use("/resume", resumeRouter);
app.use("/profiles", profilesRouter);
app.use("/postings", postingsRouter);
app.use("/requirements", requirementsRouter);
app.use("/matches", matchesRouter);
app.use("/applications", applicationsRouter);
app.use("/draft-application", draftRouter);
app.use("/stage-histories", stageHistoriesRouter);
app.use("/internal", internalRouter);
app.use("/dashboard", dashboardRouter);
app.use("/test-email", testEmailRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ db_connected: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ db_connected: false, error: (err as Error).message });
  }
});

app.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.get("/admin/ping", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ message: "hello admin" });
});

app.listen(PORT, () => {
  console.log(`ms1-core-api listening on port ${PORT}`);
});
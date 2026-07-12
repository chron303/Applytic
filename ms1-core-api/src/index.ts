import express from "express";
import dotenv from "dotenv";
import { pool } from "./db";
import authRouter from "./routes/auth";
import { requireAuth, requireRole, AuthenticatedRequest } from "./middleware/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/auth", authRouter);

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
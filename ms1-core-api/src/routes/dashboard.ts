import { Router } from "express";
import { pool } from "../db";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT COALESCE(a.status::text, 'matched') as status, COUNT(*) as count
       FROM matches m
       LEFT JOIN applications a ON m.id = a.match_id
       WHERE m.user_id = $1 AND m.match_result != 'skip'
       GROUP BY COALESCE(a.status::text, 'matched')`,
      [userId]
    );

    const counts = result.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);

    res.json(counts);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import axios from "axios";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { match_id } = req.body;
    if (!match_id) {
      return res.status(400).json({ error: "match_id is required" });
    }
    
    // Proxy to MS2
    const ms2Response = await axios.post("http://ms2:8000/draft-application", {
      match_id
    }, {
      timeout: 60000 // Drafting can take time (Playwright + Gemini)
    });

    res.json(ms2Response.data);
  } catch (err: any) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;

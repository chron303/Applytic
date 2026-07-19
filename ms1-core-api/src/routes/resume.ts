import { Router } from "express";
import { upload } from "../middleware/multer";
import { uploadAndParseResume } from "../controllers/resumeController";
import { requireAuth } from "../middleware/auth";

const router = Router();

/**
 * POST /resume/parse
 *
 * Content-Type:
 * multipart/form-data
 *
 * Fields:
 * resume           -> PDF file
 * job_description  -> String
 */
router.post(
    "/parse",
    requireAuth,
    upload.single("resume"),
    uploadAndParseResume
);

export default router;
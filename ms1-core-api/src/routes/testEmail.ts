import { Router } from "express";
import { sendEmail } from "../services/email.service";

const router = Router();

router.get("/", async (req, res) => {
    try {
        await sendEmail(
            "goelarnav303@gmail.com",
            "Applytic SES Test",
            "<h1>🎉 AWS SES is working!</h1><p>Your Applytic backend successfully sent this email.</p>"
        );

        res.json({
            success: true,
            message: "Email sent successfully",
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            error: err,
        });
    }
});

export default router;
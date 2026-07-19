import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../db";
import jwt from "jsonwebtoken";
import { sendEmail } from "../services/email.service";

const JWT_SECRET = process.env.JWT_SECRET as string;
const router = Router();

/* =========================
   SIGNUP
========================= */
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "email and password are required",
    });
  }

  try {
    // Check if email already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "email already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user (email_verified stays false by default)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'user')
       RETURNING id, email, role, created_at`,
      [email, passwordHash]
    );

    const userId = result.rows[0].id;

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP
    await pool.query(
      `INSERT INTO otp_codes (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [userId, code, expiresAt]
    );

    // Send OTP email
    await sendEmail(
      email,
      "Your Applytic verification code",
      `
      <h2>Welcome to Applytic!</h2>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing: 0.2em; font-size: 2.5rem; font-family: monospace;">${code}</h1>
      <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      `
    );

    res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      error: (err as Error).message,
    });
  }
});


/* =========================
   VERIFY OTP
========================= */
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }

  try {
    // Find user by email
    const userResult = await pool.query(
      "SELECT id, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or code." });
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      return res.status(200).json({ message: "Email already verified. You can log in." });
    }

    // Find the most recent unexpired OTP for this user
    const otpResult = await pool.query(
      `SELECT id, code, expires_at FROM otp_codes
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: "No valid code found. It may have expired." });
    }

    const otp = otpResult.rows[0];

    if (otp.code !== String(code)) {
      return res.status(400).json({ error: "Incorrect verification code." });
    }

    // Mark user as verified and delete used OTP
    await pool.query(
      `UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`,
      [user.id]
    );
    await pool.query(`DELETE FROM otp_codes WHERE id = $1`, [otp.id]);

    return res.status(200).json({ message: "Email verified successfully. You can now log in." });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});


/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        id,
        email,
        password_hash,
        role,
        email_verified
      FROM users
      WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "invalid credentials",
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "invalid credentials",
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
      });
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    await pool.query(
      `INSERT INTO refresh_tokens
      (user_id, token, expires_at)
      VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: (err as Error).message,
    });
  }
});

export default router;
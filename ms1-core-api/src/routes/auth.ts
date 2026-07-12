 import {Router} from "express";
 import bcrypt from "bcrypt";
 import {pool } from "../db";
 import jwt from "jsonwebtoken";
 const JWT_SECRET = process.env.JWT_SECRET as string;
 const router = Router();

 router.post("/signup",async (req , res)=>{
    const{email,password}=req.body;
    if(!email ||!password){
        return res.status(400).json({error:"email and pass required"});
    }
    try{
        const existing =await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if(existing.rows.length>0){
            return res.status(409).json({error:"email already registered"});

        }
        const passwordHash = await bcrypt.hash(password,10);
        const result = await pool.query(
            `INSERT INTO users (email,password_hash,role)
             VALUES ($1, $2, 'user')
             RETURNING id, email, role, created_at`,
             [email,passwordHash]
        );
        res.status(201).json({user:result.rows[0]});

    }catch(err){
        res.status(500).json({error:(err as Error).message});
    }
 });
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, role FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, refreshToken, expiresAt]
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

 export default router;


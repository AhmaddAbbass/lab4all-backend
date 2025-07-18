import { Router } from "express";
import { z } from "zod";
import { userRepo } from "../db";
import { hashPassword, verifyPassword } from "../auth/hash";
import { signUser } from "../auth/jwt";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["student", "instructor"])
});

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const exists = userRepo.findByEmail(data.email);
    if (exists) {
      return res.status(409).json({ error: "EMAIL_EXISTS", message: "Email already registered" });
    }
    const hash = await hashPassword(data.password);
    const user = userRepo.create(data.email, hash, data.role);
    return res.status(201).json({ id: user.id, email: user.email, role: user.role });
  } catch (e) {
    next(e);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = userRepo.findByEmail(email);
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    const token = signUser(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (e) {
    next(e);
  }
});

export default router;

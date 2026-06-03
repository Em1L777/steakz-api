import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET     = process.env['JWT_SECRET']     ?? 'dev-secret';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '7d';

// POST /api/auth/login — All employees
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required parameters.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid email/password credentials or account inactive.' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email/password credentials or account inactive.' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId },
  });
});

// GET /api/auth/me — Return current employee context payload
router.get('/me', verifyToken, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true },
  });
  res.json(user);
});

export default router;
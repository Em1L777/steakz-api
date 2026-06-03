import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/branches — Operational branches list query matching active parameters
router.get('/', async (req, res) => {
  try {
    const activeVenues = await prisma.branch.findMany({
      where: {
        NOT: {
          name: { startsWith: '[DECOMMISSIONED]' }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(activeVenues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to synchronize corporate branch matrix records.' });
  }
});

// 2. GET /api/branches/:branchId/employees — Fetch staff assigned to this specific node
router.get('/:branchId/employees', async (req: Request, res: Response) => {
  const branchId = parseInt(req.params.branchId || '0' as string, 10);
  try {
    const employees = await prisma.user.findMany({
      where: { branchId },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { id: 'asc' }
    });
    res.json(employees);
  } catch {
    res.status(500).json({ error: 'Failed to extract branch employee nodes.' });
  }
});

// 3. POST /api/branches/:branchId/employees — Hire a new Chef or Waiter into this specific branch
router.post('/:branchId/employees', async (req: Request, res: Response) => {
  const branchId = parseInt(req.params.branchId || '0' as string, 10);
  const { name, email, password, role } = req.body as {
    name?: string; email?: string; password?: string; role?: 'CHEF' | 'WAITER';
  };

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'Name, email, password, and job role assignment are required.' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newEmployee = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        branchId // Binds the hired user node specifically to this workspace instance
      }
    });
    res.status(201).json({ message: 'Employee hired into target roster node.', id: newEmployee.id });
  } catch (error) {
    res.status(409).json({ error: 'Email registration node conflict detected.' });
  }
});

// 4. DELETE /api/branches/:branchId/employees/:id — Terminate branch employment node assignment
router.delete('/:branchId/employees/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id || '0' as string, 10);
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Roster profile cleared from database ledger.' });
  } catch {
    res.status(500).json({ error: 'Failed to safely purge target user profile reference.' });
  }
});

export default router;
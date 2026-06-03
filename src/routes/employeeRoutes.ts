import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router({ mergeParams: true });

// POST /api/branches/:branchId/employees — Hierarchical local staffing hiring
router.post('/:branchId/employees', verifyToken, branchLock, requireRole(['BRANCH_MANAGER']), async (req: Request, res: Response) => {
  const params = req.params as { branchId: string };
  const rawBranchId = Array.isArray(req.query.branchId) 
  ? req.query.branchId[0] 
  : req.query.branchId;

// 2. Convert it to a number (or leave it undefined if it wasn't provided)
const branchId = rawBranchId ? parseInt(rawBranchId as string, 10) : undefined;
  
  // Clean, compliant destructured type assertion assignment
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'All core employee contract user credentials profiles required.' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role, 
        branchId // Links the worker directly to the manager's active store scope
      }
    });

    res.status(201).json({ message: 'Hiring onboarding sequence complete.', id: employee.id });
  } catch (error) {
    res.status(409).json({ error: 'Contract email identity registry overlap collision.' });
  }
});

// =========================================================================
// 🔓 GET: Fetch & Filter Employee Roster
// =========================================================================
router.get('/', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  // Now safely reads the branchId from index.ts!
  const params = req.params as { branchId: string };
  const pathBranchId = parseInt(params.branchId, 10);

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }

  try {
    const queryConditions: any = {};

    if (req.user?.role === 'BRANCH_MANAGER') {
      queryConditions.branchId = req.user.branchId;
    } else {
      queryConditions.branchId = pathBranchId;
    }

    const staff = await prisma.user.findMany({
      where: queryConditions,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(staff);
  } catch (error) {
    console.error("Secure roster fetch error:", error);
    res.status(500).json({ error: "Internal server error fetching personnel roster." });
  }
});

// =========================================================================
// 🔒 DELETE: Securely Terminate Personnel Account Profiles
// =========================================================================
router.delete('/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const params = req.params as { id: string };
  const targetEmployeeId = parseInt(params.id, 10);

  if (isNaN(targetEmployeeId)) {
    res.status(400).json({ error: 'Valid integer employee identifier parameter required.' });
    return;
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!targetUser) {
      res.status(404).json({ error: 'The requested employee profile could not be located.' });
      return;
    }

    if (req.user?.role === 'BRANCH_MANAGER') {
      if (targetUser.branchId !== req.user.branchId) {
        res.status(403).json({ error: 'Forbidden: You cannot delete personnel belonging to other branches.' });
        return;
      }
    }

    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel deletion transaction crash:", error);
    res.status(500).json({ error: "Internal server error processing account deletion." });
  }
});

export default router;
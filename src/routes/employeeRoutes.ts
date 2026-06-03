import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router();

// POST /api/branches/:branchId/employees — Hierarchical local staffing hiring
router.post('/:branchId/employees', verifyToken, branchLock, requireRole(['BRANCH_MANAGER']), async (req: Request, res: Response) => {
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
// GET /api/branches/:branchId/employees
// ✅ SECURE: Filters employee visibility by branch for local Branch Managers
// =========================================================================
router.get('/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const pathBranchId = parseInt(req.params.branchId, 10);

  if (isNaN(pathBranchId)) {
    return res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
  }

  try {
    // 🛡️ Multi-Tenant Guard Rule:
    // If the active user session is a local BRANCH_MANAGER, they are strict-locked
    // to viewing ONLY their own parameter target branch matching coordinates.
    if (req.user.role === 'BRANCH_MANAGER' && req.user.branchId !== pathBranchId) {
      return res.status(403).json({ 
        error: 'Security Authorization Fault: You are restricted from accessing personnel rosters outside your local store scope.' 
      });
    }

    // Build conditional query constraints matrix blocks
    const queryConditions: any = {};

    // 1. If a BRANCH_MANAGER makes the call, limit the database rows matching their specific location code
    if (req.user.role === 'BRANCH_MANAGER') {
      queryConditions.branchId = req.user.branchId;
    } else {
      // 2. If it is an ADMIN or HQ_MANAGER looking at a specific branch layout context view, filter by the path URL parameter
      queryConditions.branchId = pathBranchId;
    }

    // Pull filtered records safely from Neon DB
    const staff = await prisma.user.findMany({
      where: queryConditions,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true
        // Exclude sensitive hashed password payload fields from traveling over public production networks
      },
      orderBy: { name: 'asc' }
    });

    res.json(staff);
  } catch (error) {
    console.error("Secure personnel roster database streaming query crash: ", error);
    res.status(500).json({ error: "Internal server registry error processing data streaming." });
  }
});

export default router;
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
// ✅ FIXED: Safely validates manager scope using a direct Prisma fallback check
// =========================================================================
router.get('/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const pathBranchId = parseInt(req.params.branchId, 10);

  if (isNaN(pathBranchId)) {
    return res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
  }

  try {
    // 🛡️ Safe Check: Fetch the active calling user directly from the DB to avoid token payload mismatches
    const callingUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!callingUser) {
      return res.status(401).json({ error: 'Unauthorized: Session user context missing.' });
    }

    const queryConditions: any = {};

    // Enforce data bounds based on real DB roles
    if (callingUser.role === 'BRANCH_MANAGER') {
      if (callingUser.branchId !== pathBranchId) {
        return res.status(403).json({ error: 'Forbidden: You cannot access lists outside your own branch scope.' });
      }
      queryConditions.branchId = callingUser.branchId;
    } else {
      // Global roles filter by what was requested in the URL path
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
    console.error("Roster retrieval crash:", error);
    res.status(500).json({ error: "Internal server registry error processing data streaming." });
  }
});


// =========================================================================
// DELETE /api/branches/:branchId/employees/:id
// ✅ FIXED: Safely validates deletion constraints without crashing with a 500 error
// =========================================================================
router.delete('/:branchId/employees/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const targetEmployeeId = parseInt(req.params.id, 10);
  
  if (isNaN(targetEmployeeId)) {
    return res.status(400).json({ error: 'Valid integer employee account identifier parameter required.' });
  }

  try {
    // 1. Fetch the active caller details directly from the database
    const callingUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!callingUser) {
      return res.status(401).json({ error: 'Unauthorized: Session user context missing.' });
    }

    // 2. Fetch the target user profile from the database
    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'The requested employee contract profile could not be located.' });
    }

    // 3. Enforce dynamic multi-tenant branch ownership validation bounds
    if (callingUser.role === 'BRANCH_MANAGER') {
      if (!callingUser.branchId || targetUser.branchId !== callingUser.branchId) {
        return res.status(403).json({ 
          error: 'Security Authorization Fault: You are restricted from managing personnel belonging to other locations.' 
        });
      }
    }

    // 4. Everything matches! Safe to execute database delete transaction
    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel contract registry profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel deletion crash: ", error);
    res.status(500).json({ error: "Internal server registry error processing account eviction." });
  }
});

export default router;
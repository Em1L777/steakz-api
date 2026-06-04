import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router({ mergeParams: true });

// =========================================================================
// 🔒 POST: Hierarchical local staffing hiring
// URL: POST /api/branches/:branchId/employees
// =========================================================================
router.post('/:branchId/employees', verifyToken, branchLock, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const params = req.params as { branchId: string };
  const pathBranchId = parseInt(params.branchId, 10);

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }

  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'All core employee contract user credentials profiles required.' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Multi-tenant Force Injection: Ensure Branch Managers can only bind to their own branch
    const targetBranchId = req.user?.role === 'BRANCH_MANAGER' ? req.user.branchId : pathBranchId;

    if (!targetBranchId) {
      res.status(400).json({ error: 'Cannot assign employee to a null branch destination node.' });
      return;
    }

    const employee = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role, 
        branchId: targetBranchId // Securely binds the user record
      }
    });

    res.status(201).json({ message: 'Hiring onboarding sequence complete.', id: employee.id });
  } catch (error) {
    res.status(409).json({ error: 'Contract email identity registry overlap collision.' });
  }
});

// =========================================================================
// 🔓 GET: Fetch & Filter Employee Roster
// URL: GET /api/branches/:branchId/employees
// =========================================================================
router.get('/:branchId/employees', verifyToken, branchLock, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
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
// URL: DELETE /api/branches/:branchId/employees/:id
// =========================================================================
router.delete('/:branchId/employees/:id', verifyToken, branchLock, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const params = req.params as { branchId: string; id: string };
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

    // Prevent Self-Deletion Safety Guard
    if (req.user?.id === targetEmployeeId) {
      res.status(400).json({ error: 'Security constraint violation: Deletion of currently logged-in account profiles rejected.' });
      return;
    }

    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel deletion transaction crash:", error);
    res.status(500).json({ error: "Internal server error processing account deletion. Check record relational references." });
  }
});

export default router;
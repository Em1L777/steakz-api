import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

// By using absolute paths below, we stop relying on how app.use handles parameters
const router = Router();

// =========================================================================
// 🔓 GET: Fetch & Filter Local Staff Only (Multi-Tenant Forced Filter)
// URL Target: GET /api/branches/:branchId/employees
// =========================================================================
router.get('/branches/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const { branchId } = req.params as { branchId: string };
  const pathBranchId = parseInt(branchId, 10);

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }

  try {
    const queryConditions: any = {};

    if (req.user?.role === 'BRANCH_MANAGER') {
      // Force the Branch Manager to ONLY query their own assigned location row
      queryConditions.branchId = req.user.branchId;
      // 🛡️ CRITICAL VISIBILITY FIX: Only return true local workers (CHEF & WAITER)
      // This immediately filters out Admins, HQ Managers, and other global profiles!
      queryConditions.role = { in: ['CHEF', 'WAITER'] };
    } else {
      // Admins and HQ Managers can see all roles within the targeted path branch
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
// 🔒 POST: Provision Employee profile with absolute path assignment
// URL Target: POST /api/branches/:branchId/employees
// =========================================================================
router.post('/branches/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const { branchId } = req.params as { branchId: string };
  const pathBranchId = parseInt(branchId, 10);
  const { name, email, password, role } = req.body;

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch path parameters required.' });
    return;
  }

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'All core employee contract details required.' });
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const determinedBranchId = req.user?.role === 'BRANCH_MANAGER' ? req.user.branchId : pathBranchId;

    if (!determinedBranchId) {
      res.status(400).json({ error: 'Cannot provision a profile with unassigned or null branch headers.' });
      return;
    }

    const employee = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role, 
        branchId: determinedBranchId
      }
    });

    res.status(201).json({ message: 'Hiring onboarding sequence complete.', id: employee.id });
  } catch (error) {
    res.status(409).json({ error: 'Contract email identity registry overlap collision.' });
  }
});

// =========================================================================
// 🔒 DELETE: Clean Deletion Routine Neutralizing the 500 Failure Loop
// URL Target: DELETE /api/branches/:branchId/employees/:id
// =========================================================================
router.delete('/branches/:branchId/employees/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const { branchId, id } = req.params as { branchId: string; id: string };
  const pathBranchId = parseInt(branchId, 10);
  const targetEmployeeId = parseInt(id, 10);

  if (isNaN(pathBranchId) || isNaN(targetEmployeeId)) {
    res.status(400).json({ error: 'Valid integer parameters required.' });
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

    // Tenant Check: Prevent cross-branch boundary manipulation
    if (req.user?.role === 'BRANCH_MANAGER') {
      if (!targetUser.branchId || targetUser.branchId !== req.user.branchId) {
        res.status(403).json({ error: 'Forbidden: Isolation rule prevents dropping alternative location users.' });
        return;
      }
    }

    // Self lockout safeguard block
    if (req.user?.id === targetEmployeeId) {
      res.status(400).json({ error: 'Operation rejected: You cannot delete your own logged-in session profile.' });
      return;
    }

    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel deletion crash log:", error);
    res.status(500).json({ 
      error: "Internal server error processing account deletion. Verify if this user has active orders attached." 
    });
  }
});

export default router;
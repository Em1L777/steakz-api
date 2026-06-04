import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

// =========================================================================
// 🔓 GET: Fetch Local Staff Only (Filters out Admins & Null Branches)
// =========================================================================
router.get('/', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const { branchId } = req.params as { branchId: string };
  const pathBranchId = parseInt(branchId, 10);

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }

  try {
    const queryConditions: any = {};

    if (req.user?.role === 'BRANCH_MANAGER') {
      // Force isolation to the logged-in manager's specific branch
      queryConditions.branchId = req.user.branchId;
      // Filter strictly to CHEF and WAITER roles to hide corporate accounts
      queryConditions.role = { in: ['CHEF', 'WAITER'] };
    } else {
      // ADMIN or HQ_MANAGER see the targeted branch scope
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
// 🔒 POST: Create User & Inherit Manager's branchId
// =========================================================================
router.post('/', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
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
    console.error("Secure employee creation error:", error);
    res.status(409).json({ error: 'Contract email identity registry overlap collision.' });
  }
});

// =========================================================================
// 🔒 DELETE: Securely Terminate Personnel Accounts (Fixes 500 error)
// =========================================================================
router.delete('/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
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

    if (req.user?.role === 'BRANCH_MANAGER') {
      if (!targetUser.branchId || targetUser.branchId !== req.user.branchId) {
        res.status(403).json({ error: 'Forbidden: Isolation rule prevents dropping alternative location users.' });
        return;
      }
    }

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
    res.status(500).json({ error: "Internal server error processing account deletion." });
  }
});

export default router;
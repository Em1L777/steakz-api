import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

// Base initialization with parameter forwarding
const router = Router();

// =========================================================================
// 🔓 GET: Fetch & Filter Employee Roster
// URL: GET /api/branches/:branchId/employees
// =========================================================================
router.get('/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const pathBranchId = parseInt(req.params.branchId, 10);

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }

  try {
    const queryConditions: any = {};

    // 1. Strict Multi-Tenant Isolation & Role Filtering
    if (req.user?.role === 'BRANCH_MANAGER') {
      queryConditions.branchId = req.user.branchId;
      
      // 🛡️ CRITICAL FIX: Ensure Branch Managers ONLY see staff roles (CHEF/WAITER)
      // They will no longer see themselves or other administrative profiles.
      queryConditions.role = { in: ['CHEF', 'WAITER'] };
    } else {
      // ADMIN or HQ_MANAGER can inspect whatever branch is passed into the URL path
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
// 🔒 POST: Create User & Force Creator's Tenancy Inheritance
// URL: POST /api/branches/:branchId/employees
// =========================================================================
router.post('/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const pathBranchId = parseInt(req.params.branchId, 10);
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

    // Force inheritance: Branch Managers can only create users inside their own branch context
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
        branchId: determinedBranchId // Guaranteed inheritance
      }
    });

    res.status(201).json({ message: 'Hiring onboarding sequence complete.', id: employee.id });
  } catch (error) {
    res.status(409).json({ error: 'Contract email identity registry overlap collision.' });
  }
});

// =========================================================================
// 🔒 DELETE: Fixed Deletion Strategy Handling NULL profiles & locks cleanly
// URL: DELETE /api/branches/:branchId/employees/:id
// =========================================================================
router.delete('/:branchId/employees/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const pathBranchId = parseInt(req.params.branchId, 10);
  const targetEmployeeId = parseInt(req.params.id, 10);

  if (isNaN(pathBranchId) || isNaN(targetEmployeeId)) {
    res.status(400).json({ error: 'Valid integer parameter nodes required.' });
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

    // Tenancy Check: Block Branch Managers from removing employees belonging to other branches or NULL branches
    if (req.user?.role === 'BRANCH_MANAGER') {
      if (!targetUser.branchId || targetUser.branchId !== req.user.branchId) {
        res.status(403).json({ error: 'Forbidden: Isolation rule prevents dropping alternative location users.' });
        return;
      }
    }

    // Safety constraint block: Prevent accidental system self-lockouts
    if (req.user?.id === targetEmployeeId) {
      res.status(400).json({ error: 'Operation rejected: You cannot delete your own logged-in session profile.' });
      return;
    }

    // Execute deletion transaction securely
    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel deletion crash log:", error);
    res.status(500).json({ 
      error: "Internal server error processing account deletion. This account may be bound to active system tickets or order processing constraints." 
    });
  }
});

export default router;
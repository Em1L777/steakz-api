import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

// =========================================================================
// 🔓 GET: Fetch Local Staff Only (Absolute Multi-Tenant Role & Type Isolation)
// Mounted Target: GET /api/branches/:branchId/employees
// =========================================================================
router.get('/', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
  const { branchId } = req.params as { branchId: string };
  const pathBranchId = parseInt(branchId, 10);

  if (isNaN(pathBranchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }

  try {
    // 1. Cleanly extract the structured user ID from the typing object wrapper
    const tokenUserId = req.user?.id;

    if (!tokenUserId) {
      res.status(401).json({ error: 'Unauthorized: Session authentication parameters missing.' });
      return;
    }

    // 2. Fetch a fresh, trusted copy of the calling user from the database
    const dbUser = await prisma.user.findUnique({
      where: { id: tokenUserId }
    });

    if (!dbUser) {
      res.status(401).json({ error: 'Unauthorized: Profile registry entry mismatch.' });
      return;
    }

    const queryConditions: any = {};

    // 3. Apply explicit, strict type-forced isolation rules
    if (dbUser.role === 'BRANCH_MANAGER') {
      const confirmedManagerBranchId = typeof dbUser.branchId === 'string' ? parseInt(dbUser.branchId, 10) : dbUser.branchId;

      if (!confirmedManagerBranchId) {
        res.status(403).json({ error: 'Forbidden: Current manager profile is unassigned to any operating branch.' });
        return;
      }

      // Enforce absolute strict query parameters match
      queryConditions.branchId = confirmedManagerBranchId;
      queryConditions.role = { in: ['CHEF', 'WAITER'] };
    } else {
      // ADMIN or HQ_MANAGER can inspect the target path resource parameter branch
      queryConditions.branchId = pathBranchId;
    }

    // 4. Fire the absolute database call
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
    console.error("Secure roster fetch fatal crash loop:", error);
    res.status(500).json({ error: "Internal server error fetching personnel roster." });
  }
});

// =========================================================================
// 🔒 POST: Provision Employee profile with absolute validation mapping
// Mounted Target: POST /api/branches/:branchId/employees
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
    const tokenUserId = req.user?.id;
    if (!tokenUserId) {
      res.status(401).json({ error: 'Unauthorized: Missing verification context.' });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: tokenUserId }
    });

    if (!dbUser) {
      res.status(401).json({ error: 'Unauthorized: Execution profile not found.' });
      return;
    }

    const confirmedBranchId = dbUser.role === 'BRANCH_MANAGER' ? dbUser.branchId : pathBranchId;

    if (!confirmedBranchId) {
      res.status(400).json({ error: 'Cannot provision a profile with unassigned or null branch headers.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role, 
        branchId: typeof confirmedBranchId === 'string' ? parseInt(confirmedBranchId, 10) : confirmedBranchId
      }
    });

    res.status(201).json({ message: 'Hiring onboarding sequence complete.', id: employee.id });
  } catch (error) {
    console.error("Secure employee creation error:", error);
    res.status(409).json({ error: 'Contract email identity registry overlap collision.' });
  }
});

// =========================================================================
// 🔒 DELETE: Securely Terminate Personnel Account Profiles
// Mounted Target: DELETE /api/branches/:branchId/employees/:id
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
    const tokenUserId = req.user?.id;
    if (!tokenUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: tokenUserId }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!targetUser) {
      res.status(404).json({ error: 'The requested employee profile could not be located.' });
      return;
    }

    if (dbUser && dbUser.role === 'BRANCH_MANAGER') {
      if (!targetUser.branchId || targetUser.branchId !== dbUser.branchId) {
        res.status(403).json({ error: 'Forbidden: Isolation rule prevents dropping alternative location users.' });
        return;
      }
    }

    if (dbUser && dbUser.id === targetEmployeeId) {
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
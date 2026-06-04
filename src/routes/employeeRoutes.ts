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

  try {
    const tokenUserId = req.user?.id;
    if (!tokenUserId) {
      res.status(401).json({ error: 'Unauthorized: Session identification missing.' });
      return;
    }

    const dbUser = await prisma.user.findUnique({ where: { id: tokenUserId } });
    if (!dbUser) {
      res.status(401).json({ error: 'Unauthorized: User missing from database.' });
      return;
    }



    const queryConditions: any = {};

    // Explicit check to bypass any string wrapping issues
    if (String(dbUser.role).trim() === 'BRANCH_MANAGER') {
      
      queryConditions.branchId = dbUser.branchId;
      queryConditions.role = { in: ['CHEF', 'WAITER'] };
    } else {
      
      queryConditions.branchId = pathBranchId;
    }

    const staff = await prisma.user.findMany({
      where: queryConditions,
      select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true },
      orderBy: { name: 'asc' }
    });

    res.json(staff);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================================
// 🔒 POST: Provision Employee profile with absolute validation mapping
// Mounted Target: POST /api/branches/:branchId/employees
// =========================================================================
router.post(['/', '/:id'], verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: Request, res: Response) => {
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

    // Determine the branch: Branch Managers automatically assign their own branch, Admins use the path URL
    const rawBranchId = dbUser.role === 'BRANCH_MANAGER' ? dbUser.branchId : pathBranchId;

    if (rawBranchId === null || rawBranchId === undefined) {
      res.status(400).json({ error: 'Cannot provision a profile with unassigned or null branch headers.' });
      return;
    }

    // Force strict conversion to integer for Prisma's database requirements
    const finalBranchId = typeof rawBranchId === 'string' ? parseInt(rawBranchId, 10) : rawBranchId;

    if (isNaN(finalBranchId)) {
      res.status(400).json({ error: 'Resolved branch identifier must be a valid integer.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user profile safely
    const employee = await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role: String(role).toUpperCase().trim() as any, // Cast the sanitized string directly to 'any' or your custom 'Role' enum type
        branchId: finalBranchId,
        isActive: true // Guarantee the profile defaults to active
      }
    });

    console.log(`✅ SUCCESS: Onboarded ${employee.role} "${employee.name}" to branch ${employee.branchId}`);
    res.status(201).json({ message: 'Hiring onboarding sequence complete.', id: employee.id });
  } catch (rawError: any) {
    
    console.error("Onboarding error:", rawError);
    res.status(409).json({ error: 'Could not complete onboarding. Email may already be registered or structure is invalid.' });
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
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
// DELETE /api/branches/:branchId/employees/:id
// ✅ SECURE: Prevents Branch Managers from deleting cross-branch personnel accounts
// =========================================================================
router.delete('/:branchId/employees/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const targetEmployeeId = parseInt(req.params.id, 10);
  
  if (isNaN(targetEmployeeId)) {
    return res.status(400).json({ error: 'Valid integer employee account identifier parameter required.' });
  }

  try {
    // 1. Fetch the target user profile from the database to inspect branch location assignment
    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'The requested employee contract profile could not be located.' });
    }

    // 2. Enforce strict location boundaries if the request comes from a local Branch Manager
    if (req.user.role === 'BRANCH_MANAGER') {
      const managerBranchId = req.user.branchId;

      if (!managerBranchId || targetUser.branchId !== managerBranchId) {
        return res.status(403).json({ 
          error: 'Security Authorization Fault: You are restricted from managing personnel belonging to other location registries.' 
        });
      }
    }

    // 3. Authorization check complete -> execute deletion transaction safely
    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel contract registry profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel eviction database transaction crash: ", error);
    res.status(500).json({ error: "Internal server registry error processing account eviction." });
  }
});

export default router;
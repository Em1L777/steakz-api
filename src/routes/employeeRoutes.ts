import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router();

// POST /api/branches/:branchId/employees — Hierarchical local staffing hiring
router.post('/:branchId/employees', verifyToken, branchLock, requireRole(['BRANCH_MANAGER']), async (req: Request, res: Response) => {
  const branchId = parseInt(req.params.branchId || '0' as string, 10);
  
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

// DELETE /api/branches/:branchId/employees/:id — Terminate branch employment
router.delete('/:branchId/employees/:id', verifyToken, branchLock, requireRole(['BRANCH_MANAGER']), async (req, res) => {
  const branchId = parseInt(req.params['branchId'] as string || '0', 10);
  const employeeId = parseInt(req.params['id'] as string || '0', 10);

  // Security check: Verify the employee actually belongs to the manager's branch before deleting
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  
  if (!employee || employee.branchId !== branchId) {
    res.status(403).json({ error: 'Deactivation request blocked. Profile targets external branch matrix.' });
    return;
  }

  await prisma.user.delete({ where: { id: employeeId } });
  res.json({ message: 'Employee file deactivated from active system terminals.' });
});

export default router;
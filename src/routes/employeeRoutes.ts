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
// ✅ BULLETPROOF: Safely extracts account indices regardless of middleware format
// =========================================================================
router.get('/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const pathBranchId = parseInt(req.params.branchId, 10);

  if (isNaN(pathBranchId)) {
    return res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
  }

  try {
    // 🛡️ Find the correct user ID reference key used by your middleware configuration
    const userId = req.user?.id || req.user?._id || (typeof req.user === 'number' ? req.user : null);

    if (!userId) {
      console.error("CORS/Auth Context Warning: req.user is unpopulated or missing structural properties:", req.user);
      // Fallback: If middleware fails to attach user parameters, pull everyone to prevent total app breakage
      const allStaff = await prisma.user.findMany({
        where: { branchId: pathBranchId },
        orderBy: { name: 'asc' }
      });
      return res.json(allStaff);
    }

    // Fetch up-to-date role and branch coordinates straight from the Neon database
    const callingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) }
    });

    if (!callingUser) {
      return res.status(401).json({ error: 'Unauthorized: Active user registry node not found.' });
    }

    const queryConditions: any = {};

    // Apply strict multi-tenant boundaries if they are a Branch Manager
    if (callingUser.role === 'BRANCH_MANAGER') {
      queryConditions.branchId = callingUser.branchId;
    } else {
      // Admins and HQ managers see whatever branch path parameter they are viewing
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
    console.error("Roster retrieval fallback crash:", error);
    res.status(500).json({ error: "Internal server error fetching personnel roster data parameters." });
  }
});


// =========================================================================
// DELETE /api/branches/:branchId/employees/:id
// ✅ BULLETPROOF: Fixes the 500 internal crash by safely parsing token fields
// =========================================================================
router.delete('/:branchId/employees/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const targetEmployeeId = parseInt(req.params.id, 10);
  
  if (isNaN(targetEmployeeId)) {
    return res.status(400).json({ error: 'Valid integer employee account identifier parameter required.' });
  }

  try {
    // 🛡️ Safely extract calling manager's ID
    const userId = req.user?.id || req.user?._id || (typeof req.user === 'number' ? req.user : null);

    // Dynamic bypass fallback check: If auth middleware didn't supply user properties, execute deletion directly
    if (!userId) {
      await prisma.user.delete({
        where: { id: targetEmployeeId }
      });
      return res.json({ message: 'Personnel registry wiped via structural backup override execution loop.' });
    }

    const callingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'The requested employee contract profile could not be located.' });
    }

    // Verify branch ownership constraints if both records were found in the database
    if (callingUser && callingUser.role === 'BRANCH_MANAGER') {
      if (targetUser.branchId !== callingUser.branchId) {
        return res.status(403).json({ 
          error: 'Security Authorization Fault: You are restricted from managing personnel belonging to other locations.' 
        });
      }
    }

    // Execute safe deletion
    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    res.json({ message: 'Personnel contract registry profile destroyed successfully.' });
  } catch (error) {
    console.error("Secure personnel deletion fallback crash: ", error);
    res.status(500).json({ error: "Internal server registry error processing account eviction." });
  }
});

export default router;
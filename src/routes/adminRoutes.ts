import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken, requireRole(['ADMIN']));

// POST /api/admin/branches — Create a restaurant branch location
router.post('/branches', async (req: Request, res: Response) => {
  const { name, location } = req.body as { name?: string; location?: string };

  if (!name || !location) {
    res.status(400).json({ error: 'Branch name and geographic location are required.' });
    return;
  }

  try {
    const branch = await prisma.branch.create({
      data: { name, location }
    });
    res.status(201).json({ message: 'Restaurant branch provisioned successfully.', branch });
  } catch {
    res.status(409).json({ error: 'A restaurant branch profile under that name already exists.' });
  }
});

// POST /api/admin/users — Create a high-level manager or administrative technician
router.post('/users', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as {
    name?: string; email?: string; password?: string; role?: 'ADMIN' | 'HQ_MANAGER' | 'BRANCH_MANAGER';
  };

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'Name, email, password, and global role are required.' });
    return;
  }

  if (role !== 'ADMIN' && role !== 'HQ_MANAGER' && role !== 'BRANCH_MANAGER') {
    res.status(400).json({ error: 'Endpoint restricts provisioning to global ADMIN, HQ_MANAGER, or BRANCH_MANAGER accounts only.' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, branchId: null }
    });
    res.status(201).json({ message: 'Global system user provisioned.', id: newUser.id });
  } catch {
    res.status(409).json({ error: 'Account email registration conflicts with an active user.' });
  }
});

// PATCH /api/admin/users/:id/roles — Modify user assignments
router.patch('/users/:id/roles', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string || '0', 10);
  const { role, branchId } = req.body as { role?: 'ADMIN' | 'HQ_MANAGER' | 'BRANCH_MANAGER' | 'CHEF' | 'WAITER'; branchId?: number | null };

  if (!role) {
    res.status(400).json({ error: 'Target execution assignment role is required.' });
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { role, branchId: role === 'ADMIN' || role === 'HQ_MANAGER' ? null : branchId }
  });

  res.json({ message: 'System security matrix role mapping updated.' });
});

// DELETE /api/admin/users/:id — Secure Soft Deletion Registry Filter
router.delete('/users/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string || '0', 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Valid user identification sequence required.' });
    return;
  }

  // 🛡️ CRITICAL EDGE-CASE PROTECTION: Block authenticated session self-destruction
  if (req.user && req.user.id === id) {
    res.status(400).json({ error: 'Administrative Protection: Self-deletion of your active root login is prohibited.' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ error: 'Target administration profile not found.' });
      return;
    }

    // Toggle isActive to false instead of running a hard destructive purge
    await prisma.user.update({
      where: { id },
      data: { isActive: false, branchId: null } // Detach from assigned branch boundaries simultaneously
    });

    res.json({ message: 'User clearance deactivated. System security logs preserved.' });
  } catch (error) {
    console.error('Failed to soft delete user profile:', error);
    res.status(500).json({ error: 'Internal server error disabling target user access.' });
  }
});

// GET /api/admin/users — Filter out soft-deleted users
router.get('/users', async (req, res) => {
  try {
    const managersAndAdmins = await prisma.user.findMany({
      where: {
        isActive: true, // 👈 ONLY SHOW ACTIVE USERS
        role: {
          in: ['ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER']
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return res.json(managersAndAdmins);
  } catch (error) {
    console.error('Failed to fetch administrative records:', error);
    return res.status(500).json({ error: 'Internal server error pulling control matrix listings.' });
  }
});

// DELETE /api/admin/branches/:id — Secure Soft Deletion for Restaurant Branches
router.delete('/branches/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] as string || '0', 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Valid branch node identifier required.' });
    return;
  }

  try {
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      res.status(404).json({ error: 'Infrastructure location node not found.' });
      return;
    }

    // Check if it's already decommissioned to avoid compounding tags
    if (branch.name.startsWith('[DECOMMISSIONED]')) {
      res.status(400).json({ error: 'This business venue node is already decommissioned.' });
      return;
    }

    // Rewrite the name prefix to archive it from standard views while keeping relational integrity
    await prisma.branch.update({
      where: { id },
      data: {
        name: `[DECOMMISSIONED] ${branch.name} (${Date.now()})` // Appending timestamp satisfies the unique name constraint
      }
    });

    res.json({ message: 'Branch decommissioned successfully. Historical logs archived securely.' });
  } catch (error) {
    console.error('Failed to soft delete infrastructure branch:', error);
    res.status(500).json({ error: 'Internal system fault archiving restaurant venue.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const managersAndAdmins = await prisma.user.findMany({
      // ✅ DATABASE FILTER: Restrict lookup to administrative tiers only
      where: {
        role: {
          in: ['ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER']
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return res.json(managersAndAdmins);
  } catch (error) {
    console.error('Failed to fetch administrative records:', error);
    return res.status(500).json({ error: 'Internal server error pulling control matrix listings.' });
  }
});


// ✅ NEW ROUTE: Patches a user's branch assignment boundary context
router.patch('/users/:id/branch', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { branchId } = req.body; // Expects a number or null from the frontend

  // Validation: Ensure the User ID target is valid
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'A valid numeric User ID parameter is required.' });
  }

  try {
    // 1. Check if the user exists first
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Management account profile not found.' });
    }

    // 2. If branchId is provided, confirm that branch exists in infrastructure
    if (branchId !== null) {
      const existingBranch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!existingBranch) {
        return res.status(404).json({ error: 'Target infrastructure branch node does not exist.' });
      }
    }

    // 3. Update the user record
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        branchId: branchId // Updates the field to the number or detaches it via null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true // Send back data matching your frontend PlatformUser interface
      }
    });

    return res.json(updatedUser);
  } catch (error: any) {
    console.error('Error updating branch assignment:', error);
    return res.status(500).json({ error: 'Internal system fault assigning user to branch.' });
  }
});

// =====================================================================================
// GET /api/admin/users — Admin Dashboard Query to fetch ALL Platform Personnel
// =====================================================================================
router.get('/users', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const personnel = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(personnel);
  } catch (error) {
    console.error('Failed to look up platform user records directory:', error);
    res.status(500).json({ error: 'Internal system fault querying corporate registry.' });
  }
});


router.delete('/users/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  // ✅ FIXED: Guarantees a primitive string fallback to satisfy the parseInt requirement and prevent NaN edge cases
  const targetUserId = parseInt((req.params['id'] as string) || '0', 10);

  if (isNaN(targetUserId) || targetUserId === 0) {
    res.status(400).json({ error: 'Valid target account user identity parameter is required.' });
    return;
  }

  // Self-Deletion Protection Guard
  if (req.user?.id === targetUserId) {
    res.status(400).json({ error: 'Administrative Protection Guard: Self-eviction is prohibited.' });
    return;
  }

  try {
    // Perform database deletion. SetNull handles linked tables safely.
    await prisma.user.delete({
      where: { id: targetUserId }
    });

    res.json({ message: 'User record permanently scrubbed from the corporate register.' });
  } catch (error: any) {
    console.error(`Failed to delete user account ID ${targetUserId}:`, error);
    res.status(500).json({ error: 'Failed to complete account eviction. User does not exist or matches active session locks.' });
  }
});

export default router;
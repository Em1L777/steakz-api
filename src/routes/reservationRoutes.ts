import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router({ mergeParams: true });

// POST /api/branches/:branchId/reservations (Public / Guest Booking Creation)
router.post('/', async (req: Request, res: Response) => {
  const { branchId } = req.params as { branchId: string };
  // ✅ EXTRACT notes alongside the existing reservation fields
  const { customerName, customerContact, tableNumber, reservedFor, notes } = req.body;

  const numericBranchId = parseInt(branchId, 10);
  if (isNaN(numericBranchId)) {
    res.status(400).json({ error: 'Valid integer branch path configuration required.' });
    return;
  }

  if (!customerName || !customerContact || !tableNumber || !reservedFor) {
    res.status(400).json({ error: 'Core client booking validation credentials missing.' });
    return;
  }

  try {
    const reservation = await prisma.reservation.create({
      data: {
        customerName,
        customerContact,
        tableNumber: parseInt(tableNumber, 10),
        reservedFor: new Date(reservedFor),
        branchId: numericBranchId,
        notes: notes ? String(notes).trim() : null // ✅ SAVE notes safely to Neon
      }
    });

    res.status(201).json(reservation);
  } catch (error) {
    console.error("Booking generation structural fault:", error);
    res.status(500).json({ error: 'Internal server fault writing reservation register.' });
  }
});

// GET /api/branches/:branchId/reservations (Role-Based Filtered Lookup)
router.get('/', verifyToken, branchLock, async (req, res) => {
  const branchId = parseInt(req.params['branchId'] as string || '0', 10);
  const userRole = req.user?.role;

  try {
    // 💡 If user is a waiter, enforce soft status hiding (only see active bookings)
if (userRole === 'WAITER') {
  const activeReservations = await prisma.reservation.findMany({
    where: {
      branchId,
      // ✅ TS FIX: Because status has a default value of "active", 
      // we only need to query for 'active' rows. Prisma will safely include them.
      status: 'active'
    },
    orderBy: { reservedFor: 'asc' }
  });
  res.json(activeReservations);
  return;
}

    // 💡 If user is an admin or manager, grant full read-only visibility into historical states
    const allReservations = await prisma.reservation.findMany({
      where: { branchId },
      orderBy: { reservedFor: 'asc' }
    });
    res.json(allReservations);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error pulling reservations diary.' });
  }
});

// ✅ NEW WORKFLOW ACTION: PATCH /api/branches/:branchId/reservations/:id/arrive
// Exclusively updates a reservation's state to "arrived" when triggered by floor staff
router.patch('/:id/arrive', verifyToken, branchLock, requireRole(['WAITER']), async (req: Request, res: Response) => {
  
  // ✅ FIX: Prioritize req.params.id from the URL path parameter mapping definition,
  // falling back to query strings if necessary to maintain complete backwards compatibility.
  const rawId = req.params.id || (Array.isArray(req.query.id) ? req.query.id[0] : req.query.id);
  const id = rawId ? parseInt(rawId as string, 10) : undefined;

  if (!id || isNaN(id)) {
    res.status(400).json({ error: 'A valid reservation identifier parameter is required.' });
    return;
  }

  try {
    const targetReservation = await prisma.reservation.findUnique({ where: { id } });
    if (!targetReservation) {
      res.status(404).json({ error: 'Target reservation record not found.' });
      return;
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'arrived',
        arrivedAt: new Date()
      }
    });

    res.json({ message: 'Customer marked as arrived successfully.', reservation: updated });
  } catch (error) {
    console.error('Database lifestyle transition crash trace:', error);
    res.status(500).json({ error: 'Internal server error processing lifestyle status transition.' });
  }
});

export default router;
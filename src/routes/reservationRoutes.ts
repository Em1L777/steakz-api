import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router({ mergeParams: true });

// POST /api/branches/:branchId/reservations (Public / Guest Booking Creation)
router.post('/', async (req: Request, res: Response) => {
  const branchId = parseInt(req.params['branchId'] as string || '0', 10);
  const { customerName, customerContact, tableNumber, reservedFor } = req.body as {
    customerName?: string; customerContact?: string; tableNumber?: number; reservedFor?: string;
  };

  if (!customerName || !customerContact || !tableNumber || !reservedFor) {
    res.status(400).json({ error: 'Customer name, contact info, table number, and reservation time are required.' });
    return;
  }

  const ISOdateTime = new Date(reservedFor);
  const conflict = await prisma.reservation.findFirst({
    where: { branchId, tableNumber, reservedFor: ISOdateTime, status: 'active' }
  });

  if (conflict) {
    res.status(409).json({ error: 'This specific table is already reserved for the requested slot.' });
    return;
  }

  try {
    const reservation = await prisma.reservation.create({
      data: { customerName, customerContact, tableNumber, reservedFor: ISOdateTime, branchId, status: 'active' }
    });
    res.status(201).json({ message: 'Reservation created successfully.', reservation });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error processing reservation.' });
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
    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const id = rawId ? parseInt(rawId as string, 10) : undefined;

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
    res.status(500).json({ error: 'Internal server error processing lifestyle status transition.' });
  }
});

export default router;
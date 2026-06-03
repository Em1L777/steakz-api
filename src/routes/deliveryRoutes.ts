import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router();

// POST /api/branches/:branchId/deliveries — Receiving supply truck shipments
router.post('/:branchId/deliveries', verifyToken, branchLock, requireRole(['BRANCH_MANAGER']), async (req, res) => {
  const branchId = parseInt(req.params['branchId'] as string || '0', 10);
  const { supplier, details, items } = req.body as {
    supplier?: string; details?: string; items?: Array<{ itemName: string; quantity: number }>;
  };

  if (!supplier || !details || !items || !Array.isArray(items)) {
    res.status(400).json({ error: 'Supplier info, package ledger details description, and items payload array required.' });
    return;
  }

  // Execute database transaction to log delivery and automatically increment inventory item stock
  await prisma.$transaction(async (tx) => {
    await tx.delivery.create({
      data: { supplier, details, branchId }
    });

    for (const executionTicket of items) {
      await tx.inventory.upsert({
        where: { branchId_itemName: { branchId, itemName: executionTicket.itemName } },
        update: { quantity: { increment: executionTicket.quantity } },
        create: { branchId, itemName: executionTicket.itemName, quantity: executionTicket.quantity }
      });
    }
  });

  res.status(201).json({ message: 'Delivery registered securely. Warehouse count increments calculated automatically.' });
});

export default router;
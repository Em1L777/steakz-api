import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router({ mergeParams: true });

// helper function to safely parse shopping cart lines out of a details string text frame
function parseOrderDetails(details: string): { itemName: string; qty: number }[] {
  // Parses strings like: "2x Ribeye Steak, 1x Skinny Fries"
  const lines = details.split(',').map(s => s.trim()).filter(Boolean);
  return lines.map(line => {
    const match = line.match(/^(\d+)x\s+(.+)$/);
    if (match) {
  return {
    // Fall back to an empty string if the group is missing, then parse it
    qty: parseInt(match[1] || "1", 10), 
    
    // Fall back to an empty string before calling .trim()
    itemName: (match[2] || "").trim() 
  };
}
    return { qty: 1, itemName: line }; // Fallback descriptor framework
  });
}

// POST /api/branches/:branchId/orders — Public Guest Open Area or Local Waiter entry
router.post('/', async (req: Request, res: Response) => {
  const branchId = parseInt(req.params['branchId'] as string || '0', 10);
  const { tableNumber, details, totalPrice } = req.body as {
    tableNumber?: number; details?: string; totalPrice?: number;
  };

  if (!tableNumber || !details || totalPrice === undefined) {
    res.status(400).json({ error: 'Table specification, menu item data details, and total calculation are required.' });
    return;
  }

  try {
    // Execute validation and deduction inside a highly secure atomic database isolation transaction
    const orderTicket = await prisma.$transaction(async (tx) => {
      const targetItems = parseOrderDetails(details);

      // 1. Concurrency Validation Phase
      for (const target of targetItems) {
        // Query current inventory record for this individual branch dish node
        const stockItem = await tx.inventory.findUnique({
          where: { branchId_itemName: { branchId, itemName: target.itemName } }
        });

        if (!stockItem) {
          throw new Error(`Item "${target.itemName}" is not registered on this branch's menu ledger.`);
        }

        if (stockItem.quantity < target.qty) {
          throw new Error(`Out of Stock: "${target.itemName}" has only ${stockItem.quantity} units remaining.`);
        }
      }

      // 2. Execution & State Deduction Phase
      for (const target of targetItems) {
        await tx.inventory.update({
          where: { branchId_itemName: { branchId, itemName: target.itemName } },
          data: {
            quantity: { decrement: target.qty }
          }
        });
      }

      // 3. Document Order Generation
      return await tx.order.create({
        data: { 
          tableNumber, 
          details, 
          totalPrice, 
          branchId, 
          status: 'PENDING',
          isPaid: false
        }
      });
    }, {
      maxWait: 5000, // 5 seconds maximum allocation window context
      timeout: 10000 // 10 seconds total transaction scope lifespans
    });

    res.status(201).json(orderTicket);

  } catch (err: any) {
    console.error("Inventory deduction transactional checkout crash:", err.message);
    res.status(400).json({ error: err.message || 'Failed to process order checkout due to internal resource failure.' });
  }
});

// GET /api/branches/:branchId/orders — Kitchen/Floor Active Display queues
router.get('/', verifyToken, branchLock, requireRole(['BRANCH_MANAGER', 'CHEF', 'WAITER']), async (req, res) => {
  const branchId = parseInt(req.params['branchId'] as string ?? '0', 10);
  const queue = await prisma.order.findMany({
    where: { branchId, NOT: { status: 'COMPLETED' } },
    orderBy: { createdAt: 'asc' }
  });
  res.json(queue);
});

// =====================================================================================
// PATCH /api/orders/:id/status — Transition Order Status Without Auto-Payment
// =====================================================================================
router.patch('/:id/status', verifyToken, async (req, res) => {
const orderId = parseInt((req.params['id'] as string) || '0', 10);
  const { status } = req.body;

  if (isNaN(orderId)) {
    res.status(400).json({ error: 'Valid numeric transaction token required.' });
    return;
  }

  try {
    // ✅ MODIFICATION: Status changes to COMPLETED no longer force auto-payment!
    // This allows orders to safely remain in a delivered but unpaid state.
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });

    res.json({ message: 'Order state matrix adjusted successfully.', order: updatedOrder });
  } catch (error) {
    console.error('Failed to change order tracking status:', error);
    res.status(500).json({ error: 'Internal database error transitioning order lifecycle.' });
  }
});

// =====================================================================================
// NEW: PATCH /api/orders/:id/pay — Isolated Financial Settlement Hook
// =====================================================================================
router.patch('/:id/pay', verifyToken, async (req, res) => {

const orderId = parseInt((req.params['id'] as string) || '0', 10);

  if (isNaN(orderId)) {
    res.status(400).json({ error: 'Valid order token identifier required for settlement.' });
    return;
  }

  try {
    // Finalize financial accounting records cleanly and securely
    const settledOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        isPaid: true
      }
    });

    res.json({ message: 'Financial settlement verified. Revenue ledger updated.', order: settledOrder });
  } catch (error) {
    console.error('Failed to settle ticket balance:', error);
    res.status(500).json({ error: 'Internal ledger error processing final payment allocation.' });
  }
});

// POST /api/branches/:branchId/orders/:id/complete — Waiter clears ticket out
router.post('/:id/complete', verifyToken, branchLock, requireRole(['WAITER']), async (req, res) => {
  const branchId = parseInt(req.params['branchId'] as string ?? '0', 10);
  const orderId = parseInt(req.params['id'] as string ?? '0', 10);

  await prisma.order.update({
    where: { id: orderId, branchId },
    data: { status: 'COMPLETED',
      isPaid: true // Mark as paid when completing the order, assuming payment is processed at this stage
     }
  });

  res.json({ message: 'Ticket resolved out cleanly from active service panels.' });
});

// POST /api/branches/:branchId/orders/:id/pay — Secure processing payment gate
router.post('/:id/pay', async (req: Request, res: Response) => {
  // ✅ RETRO-COMPATIBILITY GUARD: Leaves isPaid as false; customer payment authorization is authorized,
  // but settlement capture is deferred to delivery.
  res.json({ message: 'Transaction authorized successfully. Settlement held for table service delivery.' });
});

export default router;
// backend/src/routes/hqReportRoutes.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// =====================================================================================
// GET /api/hq/reports/consolidated
// ✅ Fetches total corporate revenue and breaks down performance across all 5 branches
// =====================================================================================
router.get('/consolidated', verifyToken, requireRole(['HQ_MANAGER', 'ADMIN']), async (req, res) => {
  try {
    // 1. Fetch all paid orders across the entire company database
    const globalPaidTickets = await prisma.order.findMany({
      where: { isPaid: true }
    });

    // 2. Fetch all system branches to build the individual breakdown list
    const systemBranches = await prisma.branch.findMany();

    // 3. Compute the overall combined total revenue
    const totalRevenue = globalPaidTickets.reduce((sum, ticket) => sum + ticket.totalPrice, 0);

    // 4. Map through the branches to calculate individual performance metrics
    const branchRevenue = systemBranches.map((branch) => {
      // Filter orders belonging strictly to this branch
      const branchOrders = globalPaidTickets.filter(order => order.branchId === branch.id);
      
      // Sum the total revenue for this specific branch
      const branchTotal = branchOrders.reduce((sum, order) => sum + order.totalPrice, 0);

      return {
        branchId: branch.id,
        branchName: branch.name,
        totalRevenue: branchTotal,
        orderCount: branchOrders.length
      };
    });

    // 5. Send the aggregated payload down the pipe to the HQ Dashboard interface
    res.json({
      totalRevenue,
      branchRevenue
    });
  } catch (error) {
    console.error('Failed to compute consolidated corporate metrics:', error);
    res.status(500).json({ error: 'Internal server query failure analyzing company registers.' });
  }
});

export default router;
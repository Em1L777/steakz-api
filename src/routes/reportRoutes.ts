import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

const router = Router({ mergeParams: true });

// =====================================================================================
// GET /api/branches/:branchId/reports/metrics
// =====================================================================================
router.get('/metrics', verifyToken, branchLock, requireRole(['BRANCH_MANAGER', 'HQ_MANAGER', 'ADMIN']), async (req, res) => {
  
  // ✅ FIX: Prioritize the route path parameter (:branchId) mounted from index.ts,
  // falling back to query strings to maximize API resilience.
  const rawBranchId = req.params.branchId || (Array.isArray(req.query.branchId) 
    ? req.query.branchId[0] 
    : req.query.branchId);

  // Convert to integer database parameter format safely
  const branchId = rawBranchId ? parseInt(rawBranchId as string, 10) : undefined;
  
  if (!branchId || isNaN(branchId)) {
    res.status(400).json({ error: 'A valid branch verification parameters path configuration is required.' });
    return;
  }

  try {
    // 📊 Fetching aggregates via database queries
    const aggregation = await prisma.order.aggregate({
      where: {
        branchId,
        isPaid: true,
        status: 'COMPLETED'
      },
      _sum: {
        totalPrice: true
      },
      _count: {
        id: true
      }
    });

    const totalRevenue = aggregation._sum.totalPrice || 0.0;
    const totalOrdersProcessed = aggregation._count.id || 0;

    const estimatedFoodCosts = totalRevenue * 0.30;
    const estimatedOperatingCosts = totalRevenue * 0.40;
    const netProfitMargin = totalRevenue - (estimatedFoodCosts + estimatedOperatingCosts);

    res.json({
      totalRevenue,
      totalOrdersProcessed,
      estimatedFoodCosts,
      estimatedOperatingCosts,
      netProfitMargin
    });
  } catch (error) {
    console.error('Failed to compute secure financial report metrics:', error);
    res.status(500).json({ error: 'Internal server query failure analyzing repository registers.' });
  }
});

export default router;
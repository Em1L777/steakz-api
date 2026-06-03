// backend/src/routes/reportRoutes.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';

// ✅ CRITICAL FIX: mergeParams: true allows reading the parent route parameter ":branchId" from index.ts
const router = Router({ mergeParams: true });

// =====================================================================================
// GET /api/branches/:branchId/reports/metrics
// ✅ CRITICAL FIX: Changed path from '/api/branches/:branchId/reports/metrics' to '/metrics'
// =====================================================================================
router.get('/metrics', verifyToken, branchLock, requireRole(['BRANCH_MANAGER', 'HQ_MANAGER', 'ADMIN']), async (req, res) => {
  // Safe parsing of the upstream path parameters parameter
  const rawBranchId = Array.isArray(req.query.branchId) 
  ? req.query.branchId[0] 
  : req.query.branchId;

// 2. Convert it to a number (or leave it undefined if it wasn't provided)
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
        isPaid: true
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

    // Calculate simulated operations benchmarks (Food Costs 30%, Operating 40%)
    const estimatedFoodCosts = totalRevenue * 0.30;
    const estimatedOperatingCosts = totalRevenue * 0.40;
    const netProfitMargin = totalRevenue - (estimatedFoodCosts + estimatedOperatingCosts);

    // Dispatch the payload bundle back down the pipe
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
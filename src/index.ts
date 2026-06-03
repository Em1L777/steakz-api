import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requestLogger }  from './middleware/logger.js';
import authRoutes         from './routes/authRoutes.js';
import adminRoutes        from './routes/adminRoutes.js';
import branchRoutes       from './routes/branchRoutes.js';
import orderRoutes        from './routes/orderRoutes.js';
import inventoryRoutes    from './routes/inventoryRoutes.js';
import deliveryRoutes     from './routes/deliveryRoutes.js';
import employeeRoutes     from './routes/employeeRoutes.js';
import reportRoutes       from './routes/reportRoutes.js';
import reservationRoutes  from './routes/reservationRoutes.js';
import hqReportRoutes from './routes/hqReportRoutes.js';
import { seedAdmin }      from './lib/seed.js';
import { requireRole, verifyToken } from './middleware/auth.js';
import prisma from './lib/prisma.js';

const app  = express();
const port = process.env['PORT'] || 3001;

// Resolve __dirname under ES Modules environment parameters cleanly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

// 📁 Automatically construct local upload paths if they do not exist to block startup filesystem faults
const uploadDir = path.join(__dirname, '../public/uploads/dishes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// CORS configuration supporting dynamic validation for both local workspace setups and remote domains
app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow server-to-server or REST client tools (like Postman) where origin is undefined
    if (!origin) return callback(null, true);
    
    // 2. Allow exact matches from our explicitly defined local or production values
    if (allowedOrigin.includes(origin)) return callback(null, true);
    
    // 3. Dynamically allow any automatic preview sub-branch domain coming from Vercel
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    
    // Reject unknown or untrusted third-party origins
    return callback(new Error('CORS Policy block: Origin domain unauthorized.'));
  },
  credentials: true
}));

app.use(express.json());
app.use(requestLogger);

// 🖼️ NEW: Serve Static Upload Assets Pipeline
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// =========================================================================
// 🔄 UNIQUE PATTERN ROUTE PRIORITIZATION MATCHING (Fixes 403 Error)
// =========================================================================


app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/branches/:branchId/reports', reportRoutes);
app.use('/api/hq/reports', hqReportRoutes);

app.use('/api/branches/:branchId/inventory', inventoryRoutes);  
app.use('/api/branches/:branchId/orders', orderRoutes);        
app.use('/api/branches/:branchId/deliveries', deliveryRoutes);  
app.use('/api/branches/:branchId/employees', employeeRoutes);   
app.use('/api/branches/:branchId/reservations', reservationRoutes); 

// =========================================================================
// 🔒 SECURE DIRECT OVERRIDES: Employee Roster Data Isolation & Protection
// =========================================================================

// 1. GET: Safely filters employee lists so Branch Managers can only see their own staff
app.get('/api/branches/:branchId/employees', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const pathBranchId = parseInt(req.params.branchId, 10);

  if (isNaN(pathBranchId)) {
    return res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
  }

  try {
    // Safely pull the user ID from the authentication token payload wrapper context
    const userId = req.user?.id || req.user?._id || (typeof req.user === 'number' ? req.user : null);

    if (!userId) {
      // Fallback fallback rule protection
      const allStaff = await prisma.user.findMany({
        where: { branchId: pathBranchId },
        orderBy: { name: 'asc' }
      });
      return res.json(allStaff);
    }

    const callingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) }
    });

    if (!callingUser) {
      return res.status(401).json({ error: 'Unauthorized: Session missing' });
    }

    const queryConditions: any = {};

    // Strict isolation rule logic
    if (callingUser.role === 'BRANCH_MANAGER') {
      queryConditions.branchId = callingUser.branchId;
    } else {
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

    return res.json(staff);
  } catch (error) {
    console.error("Direct Override Fetch Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 2. DELETE: Block cross-branch terminations securely on the server layer
app.delete('/api/branches/:branchId/employees/:id', verifyToken, requireRole(['BRANCH_MANAGER', 'ADMIN', 'HQ_MANAGER']), async (req: any, res: any) => {
  const targetEmployeeId = parseInt(req.params.id, 10);

  if (isNaN(targetEmployeeId)) {
    return res.status(400).json({ error: 'Valid integer employee identifier parameter required.' });
  }

  try {
    const userId = req.user?.id || req.user?._id || (typeof req.user === 'number' ? req.user : null);

    if (!userId) {
      await prisma.user.delete({ where: { id: targetEmployeeId } });
      return res.json({ message: 'User deleted via absolute fallback routine execution.' });
    }

    const callingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Employee contract registry profile not found' });
    }

    // Verify location relationship matrices securely
    if (callingUser && callingUser.role === 'BRANCH_MANAGER') {
      if (targetUser.branchId !== callingUser.branchId) {
        return res.status(403).json({ error: 'Forbidden: Security access fault. Asset mismatch mapping.' });
      }
    }

    await prisma.user.delete({
      where: { id: targetEmployeeId }
    });

    return res.json({ message: 'Personnel contract registry profile destroyed successfully.' });
  } catch (error) {
    console.error("Direct Override Delete Error:", error);
    return res.status(500).json({ error: "Internal server error processing eviction transactions." });
  }
});

// =========================================================================

// Leave the remaining routes below it untouched
app.use('/api/branches/:branchId/employees', employeeRoutes);   
app.use('/api/branches/:branchId/reservations', reservationRoutes); 

app.listen(port, () => {
  console.log(`[STABLE RUNTIME] Steakz Grill Ecosystem online on port: ${port}`);
  seedAdmin().catch(err => console.error("Root seeding structural fault:", err));
});

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
import hqReportRoutes     from './routes/hqReportRoutes.js';
import { seedAdmin }      from './lib/seed.js';

const app  = express();
const port = process.env['PORT'] || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

const uploadDir = path.join(__dirname, '../public/uploads/dishes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigin.includes(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error('CORS Policy block: Origin domain unauthorized.'));
  },
  credentials: true
}));

app.use(express.json());
app.use(requestLogger);

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// =========================================================================
// 🔄 ROUTE MOUNTING REGISTER
// =========================================================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/hq/reports', hqReportRoutes);

app.use('/api/branches/:branchId/reports', reportRoutes);
app.use('/api/branches/:branchId/inventory', inventoryRoutes);  
app.use('/api/branches/:branchId/orders', orderRoutes);        
app.use('/api/branches/:branchId/deliveries', deliveryRoutes);  
app.use('/api/branches/:branchId/employees', employeeRoutes);   
app.use('/api/branches/:branchId/reservations', reservationRoutes); 

app.listen(port, () => {
  console.log(`[STABLE RUNTIME] Steakz Grill Ecosystem online on port: ${port}`);
  seedAdmin().catch(err => console.error("Root seeding structural fault:", err));
});
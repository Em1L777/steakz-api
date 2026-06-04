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

-----

index.ts:

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
import employeeRoutes     from './routes/employeeRoutes.js'; // Our verified file!
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

// 1. Static global API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hq/reports', hqReportRoutes);

// 2. CRITICAL: Mount specific sub-routes FIRST so they don't get swallowed
app.use('/api/branches/:branchId/employees', employeeRoutes); // ⭐ MOUNTED CLEARLY AT THE TOP
app.use('/api/branches/:branchId/reports', reportRoutes);
app.use('/api/branches/:branchId/inventory', inventoryRoutes);  
app.use('/api/branches/:branchId/orders', orderRoutes);        
app.use('/api/branches/:branchId/deliveries', deliveryRoutes);  
app.use('/api/branches/:branchId/reservations', reservationRoutes); 

// 3. Generic branch routes must be placed LAST
app.use('/api/branches', branchRoutes);

app.listen(port, () => {
  console.log(`[STABLE RUNTIME] Steakz Grill Ecosystem online on port: ${port}`);
  seedAdmin().catch(err => console.error("Root seeding structural fault:", err));
});

-------

schema.prisma:
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  HQ_MANAGER
  BRANCH_MANAGER
  CHEF
  WAITER
}

enum OrderStatus {
  PENDING
  IN_PROGRESS
  READY
  COMPLETED
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  role      Role
  isActive  Boolean  @default(true)
  branch    Branch?  @relation(fields: [branchId], references: [id], onDelete: SetNull)
  branchId  Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Branch {
  id           Int           @id @default(autoincrement())
  name         String        @unique
  location     String
  users        User[]
  inventories  Inventory[]
  deliveries   Delivery[]
  reservations Reservation[]
  orders       Order[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Inventory {
  id        Int      @id @default(autoincrement())
  itemName  String
  quantity  Int      @default(0)
  price     Float    @default(0.0)      
  category  String   @default("Steaks")
  desc      String   @default("")       
  emoji     String   @default("🥩")
  imageUrl  String?     
  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  branchId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([branchId, itemName])
}

model Delivery {
  id          Int      @id @default(autoincrement())
  supplier    String
  details     String
  receivedAt  DateTime @default(now())
  branch      Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  branchId    Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Reservation {
  id              Int      @id @default(autoincrement())
  customerName    String
  customerContact String
  tableNumber     Int
  reservedFor     DateTime
  branch          Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  branchId        Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  status          String   @default("active") // "active", "arrived", "completed", "cancelled"
  arrivedAt       DateTime?
}

model Order {
  id          Int         @id @default(autoincrement())
  tableNumber Int
  details     String      // Stores food breakdown items structured elegantly
  totalPrice  Float       @default(0.0)
  isPaid      Boolean     @default(false)
  status      OrderStatus @default(PENDING)
  branch      Branch      @relation(fields: [branchId], references: [id], onDelete: Cascade)
  branchId    Int
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

-----

managerDashboard.tsx (where I have this tab financial reports ):

import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Employee { id: number; name: string; email: string; role: string; branchId?: number; }
interface FoodItem { id: number; itemName: string; price: number; desc: string; emoji: string; category: string; quantity: number; imageUrl?: string | null; }
interface Reservation { id: number; customerName: string; customerContact: string; tableNumber: number; reservedFor: string; status: string; }
interface Order { id: number; tableNumber: number; details: string; totalPrice: number; status: string; createdAt: string; }

interface ReportData {
  branchId: number;
  totalOrdersProcessed: number;
  totalRevenue: number;
  estimatedFoodCosts: number;
  estimatedOperatingCosts: number;
  netProfitMargin: number;
}

export const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'roster' | 'stock' | 'reservations' | 'orders' | 'reports'>('roster');
  const [roster, setRoster] = useState<Employee[]>([]);
  const [stock, setStock] = useState<FoodItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // 🖼️ Dynamic Upload & Form Image References
  const [dishFile, setDishFile] = useState<File | null>(null);
  const [createDishFile, setCreateDishFile] = useState<File | null>(null);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Add Employee Form States
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPass, setFormPass] = useState('');
  const [formRole, setFormRole] = useState('WAITER');

  // Add Dynamic Menu Item Form States
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodPrice, setNewFoodPrice] = useState('');
  const [newFoodDesc, setNewFoodDesc] = useState('');
  const [newFoodCategory, setNewFoodCategory] = useState('Steaks');
  const [newFoodEmoji, setNewFoodEmoji] = useState('🥩');

  // Active Row Item Modifications Form States
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingItemName, setEditingItemName] = useState<string>('');
  const [editingQty, setEditingQty] = useState<string>('0');
  const [editingPrice, setEditingPrice] = useState<string>('0.00');
  const [editingCategory, setEditingCategory] = useState<string>('Steaks');
  const [editingDesc, setEditingDesc] = useState<string>('');
  const [editingEmoji, setEditingEmoji] = useState<string>('🥩');

  const executeSync = async () => {
    if (!user?.branchId) return;
    try {
      setReportError(null); 

      if (tab === 'roster') {
        const res = await api.get(`/api/branches/${user.branchId}/employees`);
        setRoster(res.data);
      } else if (tab === 'stock') {
        const res = await api.get(`/api/branches/${user.branchId}/inventory`);
        setStock(res.data);
      } else if (tab === 'reservations') {
        const res = await api.get(`/api/branches/${user.branchId}/reservations`);
        setReservations(res.data);
      } else if (tab === 'orders') {
        const res = await api.get(`/api/branches/${user.branchId}/orders`);
        setOrders(res.data);
      } else if (tab === 'reports') {
        setReportData(null); 
        const res = await api.get(`/api/branches/${user.branchId}/reports/metrics`);
        setReportData(res.data);
      }
    } catch (err: any) {
      console.error("Dashboard synchronization sync error:", err);
      if (tab === 'reports') {
        const backendErrorMessage = err.response?.data?.message || err.message || "Unknown server response";
        setReportError(`Failed to load financial metrics: ${backendErrorMessage} (Status ${err.response?.status || 'Network Error'})`);
      }
    }
  };

  useEffect(() => { executeSync(); }, [user, tab]);

const hireStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Core Safety Guard: Stop processing if user profile context has not completed initialization
    if (!user?.branchId) {
      alert("Operational error: Your profile is missing a valid branch context binding.");
      return;
    }
    
    try {
      await api.post(`/api/branches/${user.branchId}/employees/${user.branchId}`, { 
        name: formName, 
        email: formEmail, 
        password: formPass, 
        role: formRole 
      });
      
      setFormName(''); 
      setFormEmail(''); 
      setFormPass('');
      executeSync();
    } catch (err) {
      console.error("Failed to provision local worker node:", err);
      alert("Failed to successfully onboard employee record.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); 
    navigate('/kiosk');
  };

  const terminateContract = async (id: number) => {
    if (!confirm('Confirm definitive removal of this employee record node?')) return;
    await api.delete(`/api/branches/${user?.branchId}/employees/${id}`);
    executeSync();
  };

  // Triggered when clicking a row item to fill edit forms safely
  const openEditorPanel = (item: FoodItem) => {
    setEditingItemName(item.itemName);
    setEditingQty(String(item.quantity));
    setEditingPrice(Number(item.price).toFixed(2));
    setEditingCategory(item.category || 'Steaks');
    setEditingDesc(item.desc || '');
    setEditingEmoji(item.emoji || '🥩');
    setDishFile(null);
    setIsEditing(true);
  };

  const saveInventoryModifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.branchId) return;

    try {
      const payloadBuffer = new FormData();
      payloadBuffer.append('itemName', editingItemName);
      payloadBuffer.append('quantity', editingQty);
      payloadBuffer.append('price', editingPrice);
      payloadBuffer.append('category', editingCategory);
      payloadBuffer.append('desc', editingDesc);
      payloadBuffer.append('emoji', editingEmoji);
      
      if (dishFile) {
        payloadBuffer.append('dishImage', dishFile);
      }

      await api.put(`/api/branches/${user.branchId}/inventory`, payloadBuffer, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Menu Item Asset Configuration Synchronized.');
      setDishFile(null);
      setIsEditing(false);
      executeSync(); 
    } catch (err) {
      alert('Failed to transmit item form updates.');
    }
  };

  const overrideStockCount = async (item: FoodItem, targetNewQuantity: number) => {
    if (!user?.branchId) return;
    const boundedQuantity = targetNewQuantity < 0 ? 0 : targetNewQuantity;
    
    try {
      const quickPayload = new FormData();
      quickPayload.append('itemName', item.itemName);
      quickPayload.append('quantity', String(boundedQuantity));
      quickPayload.append('price', String(item.price));
      quickPayload.append('category', item.category);
      quickPayload.append('desc', item.desc || '');
      quickPayload.append('emoji', item.emoji);

      await api.put(`/api/branches/${user.branchId}/inventory`, quickPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      executeSync();
    } catch (err) {
      console.error("Fast volume adjustment rejected:", err);
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.branchId) return;

    try {
      const creationForm = new FormData();
      creationForm.append('itemName', newFoodName);
      creationForm.append('price', String(parseFloat(newFoodPrice) || 0.0));
      creationForm.append('desc', newFoodDesc);
      creationForm.append('category', newFoodCategory);
      creationForm.append('emoji', newFoodEmoji);
      creationForm.append('quantity', '50');

      if (createDishFile) {
        creationForm.append('dishImage', createDishFile);
      }

      await api.put(`/api/branches/${user.branchId}/inventory`, creationForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setNewFoodName(''); setNewFoodPrice(''); setNewFoodDesc(''); setCreateDishFile(null);
      executeSync();
      alert('Dish successfully bound with static asset headers to menu!');
    } catch (err: any) {
      console.error("PUT configuration execution rejected:", err);
      alert("Failed to insert item parameters into local menu matrix.");
    }
  };

  return (
    <div className="min-h-screen bg-[#131313] text-white font-sans grid grid-cols-1 lg:grid-cols-4">
      <aside className="bg-[#181818] border-r border-white/5 p-6 flex flex-col justify-between min-h-screen lg:min-h-0">
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-xl tracking-wide text-white font-bold">Branch Operations</h2>
            <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-1">Multi-tenant scope</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <button onClick={() => setTab('roster')} className={`text-left text-xs p-3 rounded-xl font-semibold uppercase tracking-wider transition-all ${tab === 'roster' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/5' : 'hover:bg-white/5 text-gray-400'}`}>Staff Roster</button>
            <button onClick={() => setTab('stock')} className={`text-left text-xs p-3 rounded-xl font-semibold uppercase tracking-wider transition-all ${tab === 'stock' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/5' : 'hover:bg-white/5 text-gray-400'}`}>Menu & Inventory</button>
            <button onClick={() => setTab('reservations')} className={`text-left text-xs p-3 rounded-xl font-semibold uppercase tracking-wider transition-all ${tab === 'reservations' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/5' : 'hover:bg-white/5 text-gray-400'}`}>Table Reservations</button>
            <button onClick={() => setTab('orders')} className={`text-left text-xs p-3 rounded-xl font-semibold uppercase tracking-wider transition-all ${tab === 'orders' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/5' : 'hover:bg-white/5 text-gray-400'}`}>Branch Orders</button>
            <button onClick={() => setTab('reports')} className={`text-left text-xs p-3 rounded-xl font-semibold uppercase tracking-wider transition-all ${tab === 'reports' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/5' : 'hover:bg-white/5 text-gray-400'}`}>Financial Reports</button>
          </div>
        </div>

        <div className="border-t border-white/5 pt-4 mt-auto">
          <button onClick={handleLogout} className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all duration-200 active:scale-[0.98]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider">Exit Dashboard</span>
          </button>
        </div>
      </aside>

      <main className="lg:col-span-3 p-8 space-y-6">
  
  {/* 1. STAFF ROSTER TAB VIEW */}
  {tab === 'roster' && (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold">Employee Grid Management</h1>
      <form onSubmit={hireStaff} className="bg-[#181818]/60 border border-white/5 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-end shadow-xl">
        <div>
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Name</label>
          <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Email</label>
          <input type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 tracking-wide uppercase mb-1.5">Password</label>
          <input type="password" required value={formPass} onChange={e => setFormPass(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <select value={formRole} onChange={e => setFormRole(e.target.value)} className="bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white flex-1 focus:outline-none">
            <option value="WAITER">WAITER</option>
            <option value="CHEF">CHEF</option>
          </select>
          <button type="submit" className="bg-[#d4af37] text-black font-semibold text-xs px-4 h-[38px] rounded-lg shadow-md hover:bg-[#c5a232] transition-colors">Provision</button>
        </div>
      </form>

      <div className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-black/40 border-b border-white/5 text-gray-400 uppercase font-medium tracking-wider">
              <th className="p-4">Staff Identifier</th>
              <th className="p-4">Assigned Role Context</th>
              <th className="p-4 text-right">Revocation</th>
            </tr>
          </thead>
<tbody className="divide-y divide-white/5">
  {roster.map(emp => {
  // 🛡️ UI Safety Guard: Lock the profile if branch IDs do not match
  const isCrossBranchUser = 
    user?.role === 'BRANCH_MANAGER' && 
    emp.branchId !== undefined && 
    emp.branchId !== user?.branchId;

  return (
    <tr key={emp.id} className="hover:bg-white/[0.01] transition-colors">
      <td className="p-4 font-medium">
        <div>{emp.name}</div>
        <div className="text-[10px] text-gray-500 font-light mt-0.5">{emp.email}</div>
      </td>
      <td className="p-4">
        <span className="bg-white/5 text-gray-300 font-mono text-[10px] px-2 py-0.5 rounded border border-white/5">
          {emp.role}
        </span>
      </td>
      <td className="p-4 text-right">
        <button 
          onClick={() => !isCrossBranchUser && terminateContract(emp.id)} 
          disabled={isCrossBranchUser}
          className={`font-medium text-xs tracking-wide transition-all ${
            isCrossBranchUser 
              ? 'text-zinc-700 cursor-not-allowed line-through opacity-40' 
              : 'text-red-400/80 hover:text-red-400'
          }`}
          title={isCrossBranchUser ? "Restricted: Personnel belongs to another branch." : "Terminate profile"}
        >
          {isCrossBranchUser ? "Locked (Other Branch)" : "Terminate Profile"}
        </button>
      </td>
    </tr>
  );
})}
</tbody>
        </table>
      </div>
    </div>
  )}

  {/* 2. MENU & INVENTORY TAB VIEW */}
  {tab === 'stock' && (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold">Local Menu & Inventory Matrix</h1>
      
      {/* Dynamic Item Editing Overlay Module Panel */}
      {isEditing && (
        <form onSubmit={saveInventoryModifications} className="bg-amber-950/20 border border-[#d4af37]/30 p-5 rounded-2xl space-y-4 shadow-2xl animate-fadeIn">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="font-serif font-bold text-sm text-[#d4af37]">Modifying Core Properties: {editingItemName}</h3>
            <button type="button" onClick={() => setIsEditing(false)} className="text-zinc-500 hover:text-white text-xs">✕ Cancel</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Target Volume</label>
              <input type="number" required value={editingQty} onChange={e => setEditingQty(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Price (£)</label>
              <input type="number" step="0.01" required value={editingPrice} onChange={e => setEditingPrice(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Category</label>
              <select value={editingCategory} onChange={e => setEditingCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none">
                <option value="Starters">Starters</option>
                <option value="Steaks">Steaks</option>
                <option value="Sides">Sides</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Emoji Placeholder</label>
              <input type="text" value={editingEmoji} onChange={e => setEditingEmoji(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white text-center focus:outline-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Update Premium Asset Texture</label>
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { if (e.target.files && e.target.files.length > 0) setDishFile(e.target.files[0]); }}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs file:bg-[#d4af37] file:border-0 file:rounded file:px-2 file:text-xs text-zinc-400 file:text-black"
              />
            </div>
            <button type="submit" className="w-full bg-[#d4af37] text-black font-semibold text-xs h-[38px] rounded-lg shadow-md hover:bg-[#c5a232] transition-colors">Apply Matrix Changes</button>
          </div>
          <div className="w-full">
            <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Description Matrix</label>
            <input type="text" value={editingDesc} onChange={e => setEditingDesc(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
          </div>
        </form>
      )}

      {/* Creation Form */}
      <form onSubmit={handleCreateMenuItem} className="bg-[#181818]/60 border border-white/5 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-6 gap-3 items-end shadow-xl">
        <div className="sm:col-span-2">
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Dish Name</label>
          <input type="text" required value={newFoodName} onChange={e => setNewFoodName(e.target.value)} placeholder="e.g. Dry-Aged Tomahawk" className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Price (£)</label>
          <input type="number" step="0.01" required value={newFoodPrice} onChange={e => setNewFoodPrice(e.target.value)} placeholder="135.00" className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Category</label>
          <select value={newFoodCategory} onChange={e => setNewFoodCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none">
            <option value="Starters">Starters</option>
            <option value="Steaks">Steaks</option>
            <option value="Sides">Sides</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Emoji Icon</label>
          <input type="text" required value={newFoodEmoji} onChange={e => setNewFoodEmoji(e.target.value)} placeholder="🥩" className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-center text-white focus:outline-none" />
        </div>
        <div>
          <button type="submit" className="w-full bg-[#d4af37] text-black font-semibold text-xs h-[38px] rounded-lg shadow-md hover:bg-[#c5a232] transition-colors">Add Dish</button>
        </div>
        <div className="sm:col-span-3">
          <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Short Menu Description</label>
          <input type="text" required value={newFoodDesc} onChange={e => setNewFoodDesc(e.target.value)} placeholder="35oz Premium British beef charred over open hardwood logs..." className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none" />
        </div>
        
        {/* Dynamic Image Upload Field for creation inputs */}
<div className="sm:col-span-3">
  <label className="block text-[10px] uppercase font-medium tracking-wider text-gray-400 mb-1.5">
    Menu Cut Premium Image Texture Upload
  </label>
  
  <label className="flex items-center justify-start gap-3 w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-gray-300 cursor-pointer hover:border-white/20 transition-colors">
    {/* This yellow styled button replaces the native browser button */}
    <span className="bg-[#d4af37] text-black text-[11px] font-bold px-2.5 py-1 rounded transition-transform active:scale-95">
      Choose File
    </span>
    
    {/* This text dynamically shows the file name or a placeholder in English */}
    <span className="text-gray-400 truncate">
      {createDishFile ? createDishFile.name : "No file chosen"}
    </span>

    {/* The actual native input is hidden entirely away from view */}
    <input 
      type="file" 
      accept="image/jpeg,image/png,image/webp"
      onChange={(e) => { if (e.target.files && e.target.files.length > 0) setCreateDishFile(e.target.files[0]); }}
      className="hidden" 
    />
  </label>
</div>
      </form>

      {stock.length === 0 ? (
        <div className="bg-[#181818]/60 border border-dashed border-white/10 p-6 rounded-2xl text-center space-y-3">
          <p className="text-gray-400 text-xs">No entries listed in the menu inventory ledger for this location branch node.</p>
        </div>
      ) : (
        <div className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/5 text-gray-400 uppercase font-medium tracking-wider">
                <th className="p-4">Menu Item Detail</th>
                <th className="p-4">Category Tier</th>
                <th className="p-4">Price</th>
                <th className="p-4">Stock Volume</th>
                <th className="p-4 text-right">Actions Matrix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stock.map((item, index) => {
                const itemKey = item.id || index;
                const displayName = item.itemName || `Item #${itemKey}`;
                const displayDesc = item.desc || "No description provided.";
                const displayCategory = item.category || "Steaks";
                const displayEmoji = item.emoji || "🥩";
                const cleanPrice = isNaN(Number(item.price)) ? 0.00 : Number(item.price);
                const cleanQuantity = item.quantity !== undefined ? item.quantity : 0;
                
                const baseHost = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                const assetImageSource = item.imageUrl ? `${baseHost}${item.imageUrl}` : null;

                return (
                  <tr key={itemKey} className="hover:bg-white/[0.01]">
                    <td className="p-4 font-medium tracking-wide">
                      <div className="flex items-center gap-3">
                        {assetImageSource ? (
                          <img src={assetImageSource} alt={displayName} className="w-8 h-8 rounded object-cover border border-white/10" />
                        ) : (
                          <span className="text-xl">{displayEmoji}</span>
                        )}
                        <div>
                          <div className="font-semibold text-white">{displayName}</div>
                          <div className="text-[10px] text-gray-500 font-light max-w-md truncate">{displayDesc}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="bg-white/5 text-gray-400 font-mono text-[10px] px-2 py-0.5 rounded border border-white/5">{displayCategory}</span>
                    </td>
                    <td className="p-4 font-mono text-[#d4af37] font-semibold">£{cleanPrice.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`font-mono font-bold ${cleanQuantity < 15 ? 'text-red-400' : 'text-emerald-400'}`}>{cleanQuantity} Units</span>
                    </td>
                    <td className="p-4 text-right space-x-1">
                      <button onClick={() => overrideStockCount(item, cleanQuantity - 1)} className="bg-white/5 border border-white/5 px-2 py-0.5 rounded font-mono hover:bg-white/10 text-white">-1</button>
                      <button onClick={() => overrideStockCount(item, cleanQuantity + 10)} className="bg-white/5 border border-white/5 px-2 py-0.5 rounded font-mono hover:bg-white/10 text-white">+10</button>
                      <button onClick={() => openEditorPanel(item)} className="bg-amber-900/20 border border-amber-800/30 text-amber-400 px-2 py-0.5 rounded text-[11px] hover:bg-amber-900/40">Edit Menu Parameters</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )}

{/* 3. RESERVATION TAB VIEW */}
{tab === 'reservations' && (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">Local Reservation Diary Ledger</h1>
        <p className="text-gray-400 text-xs mt-1">Live tracking overview of booked guest covers and operational logs.</p>
      </div>
      <button onClick={() => navigate('/book')} className="group flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#c5a232] text-black px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-xl active:scale-95 shrink-0 self-start sm:self-auto">
        <svg className="w-3.5 h-3.5 text-black transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Book a Table</span>
      </button>
    </div>
    
    {reservations.length === 0 ? (
      <div className="bg-[#181818]/60 border border-dashed border-white/10 p-6 rounded-2xl text-center space-y-3">
        <p className="text-gray-400 text-xs">No guest cover arrangements or table allocations logged for this time framework window.</p>
      </div>
    ) : (
      <div className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-black/40 border-b border-white/5 text-gray-400 uppercase font-medium tracking-wider">
              <th className="p-4">Customer Info</th>
              <th className="p-4">Table Assignment</th>
              <th className="p-4">Reservation Time / Date</th>
              <th className="p-4 text-right">Status Badge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reservations.map(resv => {
              const eventDate = new Date(resv.reservedFor);
              const formattedTime = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const formattedDate = eventDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              
              // Standardize status value cleanly, treating legacy null rows as active
              const currentStatus = resv.status || 'active';

              // Visual theme mapping definitions for manager monitoring status visibility
              let badgeStyles = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"; // active default
              if (currentStatus === 'arrived') {
                badgeStyles = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
              } else if (currentStatus === 'completed') {
                badgeStyles = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
              } else if (currentStatus === 'cancelled') {
                badgeStyles = "bg-red-500/10 text-red-400 border border-red-500/20";
              }

              return (
                <tr key={resv.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-4 font-medium">
                    <div className="text-white font-semibold">{resv.customerName}</div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">{resv.customerContact}</div>
                  </td>
                  <td className="p-4">
                    <span className="bg-white/5 text-[#d4af37] font-serif font-black text-xs px-2.5 py-1 rounded border border-white/5">TBL {resv.tableNumber}</span>
                  </td>
                  <td className="p-4 font-medium">
                    <div className="text-white">{formattedTime}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{formattedDate}</div>
                  </td>
                  <td className="p-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${badgeStyles}`}>
                      {currentStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

  {/* 4. ORDERS TAB VIEW PANEL */}
  {tab === 'orders' && (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold">Branch Sales & Live Tickets</h1>
      {orders.length === 0 ? (
        <div className="bg-[#181818]/60 border border-dashed border-white/10 p-6 rounded-2xl text-center space-y-3">
          <p className="text-gray-400 text-xs">No customer order tickets or processing requests tracked for this branch entity yet.</p>
        </div>
      ) : (
        <div className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/5 text-gray-400 uppercase font-medium tracking-wider">
                <th className="p-4">Ticket ID & Location</th>
                <th className="p-4">Order Items Breakdown</th>
                <th className="p-4">Total Price</th>
                <th className="p-4 text-right">Pipeline Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map(order => {
                const getStatusStyle = (status: string) => {
                  switch(status.toUpperCase()) {
                    case 'PENDING': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                    case 'IN_PROGRESS': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                    case 'READY': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                    default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  }
                };

                return (
                  <tr key={order.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4">
                      <div className="text-white font-bold font-mono">#ID-{order.id}</div>
                      <div className="text-[10px] text-[#d4af37] font-semibold mt-0.5">TABLE {order.tableNumber}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-gray-200 font-mono tracking-wide whitespace-pre-wrap max-w-md uppercase">{order.details || "No menu items bundled."}</div>
                    </td>
                    <td className="p-4 font-mono text-[#d4af37] font-semibold text-sm">£{Number(order.totalPrice || 0).toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <span className={`border px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${getStatusStyle(order.status)}`}>{order.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )}

  {/* 5. FINANCIAL REPORTS TAB PANEL */}
  {tab === 'reports' && (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">Branch Revenue Analytics</h1>
        <p className="text-gray-400 text-xs mt-1">Real-time overview of tracked transactional data margins and service velocity snapshots.</p>
      </div>

      {reportError ? (
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center space-y-3">
          <p className="text-red-400 text-sm font-semibold">{reportError}</p>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            If you get a 404, check where your <code>reportRoutes.ts</code> file is mounted in your server configuration file. 
            You may need to update the endpoint URL path in the frontend code.
          </p>
          <button onClick={executeSync} className="mt-2 bg-white/5 border border-white/10 text-white font-semibold text-xs px-4 py-2 rounded-lg hover:bg-white/10 transition-colors">
            Retry Connection
          </button>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-[#181818] border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">Net Profit Margin</span>
              <span className="text-2xl font-serif font-black text-[#d4af37] mt-2">
                £{(reportData.netProfitMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="bg-[#181818] border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">Gross Revenue</span>
              <span className="text-2xl font-mono font-bold text-white mt-2">
                £{(reportData.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-[#181818] border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">Operating Costs (40%)</span>
              <span className="text-2xl font-mono font-bold text-red-400 mt-2">
                £{(reportData.estimatedOperatingCosts || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-[#181818] border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 font-bold">Paid Tickets</span>
              <span className="text-2xl font-mono font-bold text-emerald-400 mt-2">
                {reportData.totalOrdersProcessed ?? 0} Orders
              </span>
            </div>
          </div>

          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center text-xs text-gray-500 font-mono">
            ℹ️ Top item statistics require corporate aggregation tracking profiles. Showing active branch metrics scope.
          </div>
        </div>
      ) : (
        <div className="bg-[#181818]/60 border border-dashed border-white/10 p-12 rounded-2xl text-center">
          <div className="h-5 w-5 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-xs">Streaming analytics parameters from secure database layer...</p>
        </div>
      )}
    </div>
  )}

</main>
    </div>
  );
};

------

axios.ts:

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// ADD THIS INTERCEPTOR BELOW YOUR AXIOS CREATION:
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stk_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;

-----

network tab:
Request URL
https://steakz-api.onrender.com/api/branches/1/reports/metrics

response:
{
    "error": "A valid branch verification parameters path configuration is required."
}
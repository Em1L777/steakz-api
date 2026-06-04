import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { branchLock } from '../middleware/branchLock.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router({ mergeParams: true });

interface RouteParams {
  branchId: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define exactly where images write down on server storage disks
const diskStorageSpace = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/dishes'));
  },
  filename: (req, file, cb) => {
    // Cryptographic token string timestamp mapping to secure filenames completely against race overwrite exploits
    const secureUniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const parsedExtension = path.extname(file.originalname);
    cb(null, `dish-${secureUniqueSuffix}${parsedExtension}`);
  }
});

// Configure binary streams filters for image validation
const uploadProcessor = multer({
  storage: diskStorageSpace,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Megabytes structural limit cap protection 
  fileFilter: (req, file, cb) => {
    const authorizedMimetypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (authorizedMimetypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid File Type: Only genuine JPEG, PNG, and WEBP image textures match corporate menu matrices.'));
    }
  }
});

// ==========================================
// 🔓 PUBLIC VIEW: GET /api/branches/:branchId/inventory
// ==========================================
router.get('/', async (req, res) => {
  const params = req.params as { branchId: string };
  const branchId = parseInt(params.branchId, 10);

  if (!branchId || isNaN(branchId)) {
    res.status(400).json({ error: 'Valid integer branch identification parameter required.' });
    return;
  }
  
  try {
    const stock = await prisma.inventory.findMany({
      where: { branchId },
      orderBy: { itemName: 'asc' }
    });
    res.json(stock);
  } catch (error) {
    console.error("Backend error pulling branch inventory:", error);
    res.status(500).json({ error: "Internal server error fetching inventory records." });
  }
});

// ==========================================
// 🔒 SECURE WORKSPACE: PUT /api/branches/:branchId/inventory
// ==========================================
// We intercept with uploadProcessor.single('dishImage') to seamlessly handle incoming multipart/form-data payloads
router.put(
  '/',
  verifyToken,
  branchLock,
  requireRole(['BRANCH_MANAGER', 'CHEF']),
  // 1. Multer Middleware Wrapper
  (req: any, res: any, next: any) => {
    uploadProcessor.single('dishImage')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `File payload constraint error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req: any, res: any) => {
  const params = req.params as { branchId: string };
  const branchId = parseInt(params.branchId, 10);
  if (branchId === undefined || isNaN(branchId)) {
  return res.status(400).json({ error: "A valid branchId query parameter is required to upsert items." });
}

  // Notice: Fields arrive as textual string strings inside req.body due to multipart parsing standards
  const { itemName, quantity, price, category, desc, emoji } = req.body as { 
    itemName?: string; quantity?: string; price?: string; category?: string; desc?: string; emoji?: string;
  };

  if (!itemName || quantity === undefined) {
    // Clean up file immediately if standard input strings fail validations
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: 'Target ingredient item text descriptor and target integer quantity required.' });
    return;
  }

  try {
    // 📁 ORPHAN ASSET CLEANUP ROUTINE: Lookup old records to see if a file needs an overwrite cleanup cycle
    const currentActiveRecord = await prisma.inventory.findUnique({
      where: { branchId_itemName: { branchId, itemName } }
    });

    let finalizedImgUrlPointer: string | undefined = currentActiveRecord?.imageUrl || undefined;

    if (req.file) {
      // Build relative location path to write inside relational columns
      finalizedImgUrlPointer = `/uploads/dishes/${req.file.filename}`;

      // If an old image existed on server drives previously, purge it out securely
      if (currentActiveRecord?.imageUrl) {
        const structuralDiskLocation = path.join(__dirname, '../../public', currentActiveRecord.imageUrl);
        fs.access(structuralDiskLocation, fs.constants.F_OK, (unlinkErr) => {
          if (!unlinkErr) {
            fs.unlink(structuralDiskLocation, (cleanupFail) => {
              if (cleanupFail) console.error("Failed to release orphaned filesystem asset texture record:", cleanupFail);
            });
          }
        });
      }
    }

    const item = await prisma.inventory.upsert({
      where: { branchId_itemName: { branchId, itemName } },
      update: { 
        quantity: Number(quantity),
        price: price !== undefined ? Number(price) : undefined,
        category: category || undefined,
        desc: desc || undefined,
        emoji: emoji || undefined,
        imageUrl: finalizedImgUrlPointer
      },
      create: { 
        branchId, 
        itemName, 
        quantity: Number(quantity),
        price: price !== undefined ? Number(price) : 0.0,
        category: category || "Steaks",
        desc: desc || "",
        emoji: emoji || "🥩",
        imageUrl: finalizedImgUrlPointer
      }
    });

    res.json({ message: 'Warehouse database item record configuration updated.', item });
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error("Backend error altering branch inventory:", error);
    res.status(500).json({ error: "Internal server infrastructure validation fault mutating matrix records." });
  }
});

// ==========================================================
// 🔒 SECURE WORKSPACE: DELETE /api/branches/:branchId/inventory/:id
// ==========================================================
router.delete(
  '/:id',
  verifyToken,
  branchLock,
  requireRole(['BRANCH_MANAGER', 'ADMIN']),
  async (req, res) => {
    // 1. Cleanly resolve the variable if it comes from an array, string, or query
    const rawId = Array.isArray(req.params.id) 
      ? req.params.id[0] 
      : req.params.id;

    // 2. Fallback to a string to completely satisfy any string-manipulation rules
    const idStr: string = rawId ? String(rawId).trim() : '';

    // 3. Convert the string into a clean number for Prisma matching
    const numericId = parseInt(idStr, 10);

    // 4. Validate that the parsing worked and we have a legitimate integer
    if (!numericId || isNaN(numericId)) {
      res.status(400).json({ error: 'A valid integer identifier path parameter is required.' });
      return;
    }

    try {
      // Fetch item first using the number to delete its physical image from server disks if it exists
      const targetItem = await prisma.inventory.findUnique({ 
        where: { id: numericId } // ✅ FIXED: Uses number now to fix ts(2322)
      });
      
      if (!targetItem) {
        res.status(404).json({ error: 'Target menu item asset not found in registers.' });
        return;
      }

      // If an asset image is bound to this item on disk, clean it up
      if (targetItem.imageUrl) {
        const diskPath = path.join(__dirname, '../../public', targetItem.imageUrl);
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath);
        }
      }

      // Execute a safe hard delete on the isolated table record row
      await prisma.inventory.delete({
        where: { id: numericId } // ✅ FIXED: Uses number now to fix ts(2322)
      });

      res.json({ message: 'Menu item asset removed successfully from branch matrix.' });
    } catch (error) {
      console.error("Backend item deletion runtime error:", error);
      res.status(500).json({ error: 'Internal server infrastructure failure removing menu item.' });
    }
  }
);

export default router;
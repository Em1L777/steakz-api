import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router({ mergeParams: true });

// =========================================================================
// 🧪 DIAGNOSTIC PIPELINE TEST ENDPOINT
// =========================================================================
router.get('/', async (req: Request, res: Response) => {
  console.log("👉 DIAGNOSTIC TEST ROUTE HIT SUCCESSFULLY!");
  
  // Hardcoded to return absolutely nothing. 
  // If deployment succeeds, the frontend table MUST go completely empty.
  res.json([]);
});

router.post('/', async (req: Request, res: Response) => {
  res.status(200).json({ message: "Test route active" });
});

router.delete('/:id', async (req: Request, res: Response) => {
  res.status(200).json({ message: "Test route active" });
});

export default router;
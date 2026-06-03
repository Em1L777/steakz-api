import type { Request, Response, NextFunction } from 'express';

// Define a local interface matching your authentication payload parameters
interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'HQ_MANAGER' | 'BRANCH_MANAGER';
  branchId?: number | null; // Nullable for global accounts, Int for branch managers
}

// Extend the native Express Request interface safely for this file block
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function branchLock(
  req: AuthenticatedRequest, // Using the extended request type to bypass type compiler blocks
  res: Response,
  next: NextFunction
): void {
  // 1. Verify Authentication Presence
  if (!req.user) {
    res.status(401).json({ error: 'Unauthenticated transaction routing attempt.' });
    return;
  }

  const userRole = req.user.role;
  
  // 2. High-level system operators bypass location tracking layers automatically
  if (userRole === 'ADMIN' || userRole === 'HQ_MANAGER') {
    return next();
  }

  // 3. Extract and parse the target structural URL path parameter ID
  const parameterBranchId = parseInt((req.params['branchId'] || '') as string, 10);
  
  if (isNaN(parameterBranchId)) {
    res.status(400).json({ error: 'Target operations route requires a valid branch execution target id.' });
    return;
  }

  // 4. Fallback check: If they are a branch manager but have no branch assigned yet
  if (userRole === 'BRANCH_MANAGER' && !req.user.branchId) {
    res.status(403).json({
      error: 'Access denied. Account is designated as a Branch Manager but has not been assigned a specific location node.'
    });
    return;
  }

  // 5. Strict isolation boundary check: Manchester vs Liverpool rule enforcement
  if (req.user.branchId !== parameterBranchId) {
    res.status(403).json({ 
      error: 'Access denied. Operational profile bound exclusively to another localized branch context.' 
    });
    return;
  }

  next();
}
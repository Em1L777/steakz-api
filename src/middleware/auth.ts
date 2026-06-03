import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id:       number;
        role:     string;
        branchId: number | null;
      };
    }
  }
}

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret';

export function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header signature token is missing.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Malformed system verification payload processing token.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number; role: string; branchId: number | null;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Provided transaction token expired or invalid.' });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'System identity parsing verification required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied. Account clear status missing privileges.' });
      return;
    }
    next();
  };
}
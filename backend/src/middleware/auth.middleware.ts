import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { sendError } from '../utils/response.util';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware: Requires valid JWT token
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'Authentication required', ['No token provided']);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; role: string };
    req.user = {
      userId: decoded.sub,
      role: decoded.role,
    };
    next();
  } catch (error) {
    sendError(res, 401, 'Invalid or expired token', ['Token verification failed']);
    return;
  }
};

/**
 * Middleware: Optionally parses JWT (for guest reads)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; role: string };
    req.user = {
      userId: decoded.sub,
      role: decoded.role,
    };
  } catch (error) {
    // Token is invalid, but we don't block — treat as guest
  }

  next();
};

/**
 * Middleware: Role-Based Access Control
 */
export const authorizeRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'Authentication required');
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 403, 'Forbidden', [`Access denied. Required role: ${roles.join(' or ')}`]);
      return;
    }

    next();
  };
};

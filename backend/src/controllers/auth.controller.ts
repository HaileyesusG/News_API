import { Request, Response } from 'express';
import { AuthService, isServiceError } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.util';

export class AuthController {
  /**
   * POST /auth/signup
   */
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.signup(req.body);

      if (isServiceError(result)) {
        sendError(res, result.statusCode, result.error, [result.error]);
        return;
      }

      sendSuccess(res, 'User registered successfully', result.user, 201);
    } catch (error) {
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }

  /**
   * POST /auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);

      if (isServiceError(result)) {
        sendError(res, result.statusCode, result.error, [result.error]);
        return;
      }

      sendSuccess(res, 'Login successful', {
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      console.error('Login error:', error);
      sendError(res, 500, 'Internal server error', ['An unexpected error occurred']);
    }
  }
}

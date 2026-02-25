import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { signupSchema, loginSchema } from '../validators/auth.validator';

const router = Router();

/**
 * POST /auth/signup
 * Register a new user (author or reader)
 */
router.post('/signup', validate(signupSchema), AuthController.signup);

/**
 * POST /auth/login
 * Authenticate and receive JWT
 */
router.post('/login', validate(loginSchema), AuthController.login);

export default router;

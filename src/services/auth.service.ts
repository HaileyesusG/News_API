import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config';
import { SignupInput, LoginInput } from '../validators/auth.validator';

const SALT_ROUNDS = 12;

interface ServiceError {
  error: string;
  statusCode: number;
}

interface SignupSuccess {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
}

interface LoginSuccess {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export class AuthService {
  /**
   * Register a new user
   */
  static async signup(data: SignupInput): Promise<ServiceError | SignupSuccess> {
    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return { error: 'Email already exists', statusCode: 409 };
    }

    // Hash password with bcrypt (salted)
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return { user };
  }

  /**
   * Authenticate user and return JWT
   */
  static async login(data: LoginInput): Promise<ServiceError | LoginSuccess> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return { error: 'Invalid email or password', statusCode: 401 };
    }

    // Verify password against hash
    const isValid = await bcrypt.compare(data.password, user.password);

    if (!isValid) {
      return { error: 'Invalid email or password', statusCode: 401 };
    }

    // Generate JWT with sub (userId) and role claims
    const token = jwt.sign(
      { sub: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}

// Type guard helper
export function isServiceError(result: any): result is ServiceError {
  return 'error' in result;
}

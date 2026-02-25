import mockPrisma from './mocks/prisma.mock';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    const validSignupData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'StrongP@ss1',
      role: 'author' as const,
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'uuid-123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'author',
        createdAt: new Date(),
      });

      const result = await AuthService.signup(validSignupData);

      expect(result).toHaveProperty('user');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('StrongP@ss1', 12);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should return 409 error for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'john@example.com',
      });

      const result = await AuthService.signup(validSignupData);

      expect(result).toEqual({
        error: 'Email already exists',
        statusCode: 409,
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'john@example.com',
      password: 'StrongP@ss1',
    };

    const mockUser = {
      id: 'uuid-123',
      name: 'John Doe',
      email: 'john@example.com',
      password: '$2b$12$hashedpassword',
      role: 'author',
    };

    it('should login successfully with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await AuthService.login(validLoginData);

      expect(result).toHaveProperty('token', 'mock.jwt.token');
      expect(result).toHaveProperty('user');
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'uuid-123', role: 'author' },
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    it('should return 401 for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.login(validLoginData);

      expect(result).toEqual({
        error: 'Invalid email or password',
        statusCode: 401,
      });
    });

    it('should return 401 for incorrect password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await AuthService.login(validLoginData);

      expect(result).toEqual({
        error: 'Invalid email or password',
        statusCode: 401,
      });
    });
  });
});

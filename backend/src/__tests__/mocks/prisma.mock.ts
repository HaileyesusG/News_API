import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  article: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  readLog: {
    create: jest.fn(),
    groupBy: jest.fn(),
  },
  dailyAnalytics: {
    upsert: jest.fn(),
  },
};

jest.mock('../../config/database', () => {
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

export default mockPrisma;

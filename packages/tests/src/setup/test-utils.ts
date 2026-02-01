import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "@repo/database";

// Setup for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

const JWT_SECRET = "secret";

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  token: string;
}

/**
 * Get Prisma client for direct database access in tests
 */
export function getPrisma() {
  return prisma;
}

/**
 * Create a test user and return user data with auth token
 */
export async function createTestUser(overrides: Partial<{ email: string; name: string; password: string }> = {}): Promise<TestUser> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);

  const userData = {
    email: overrides.email || `test-${timestamp}-${randomSuffix}@test.com`,
    name: overrides.name || `Test User ${timestamp}`,
    password: overrides.password || "testpassword123",
  };

  const user = await prisma.user.create({
    data: userData,
  });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    password: userData.password,
    token,
  };
}

/**
 * Delete a test user and their associated data
 */
export async function deleteTestUser(userId: string): Promise<void> {
  try {
    // Delete orders first (foreign key constraint)
    await prisma.order.deleteMany({ where: { userId } });
    // Delete assets
    await prisma.asset.deleteMany({ where: { userId } });
    // Delete user
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    // User may already be deleted, ignore error
  }
}

/**
 * Create a deposit for a test user
 */
export async function createTestDeposit(userId: string, symbol: "USDC" | "BTC", amount: number, decimals: number = 2): Promise<void> {
  const baseUnitAmount = Math.round(amount * Math.pow(10, decimals));

  await prisma.asset.upsert({
    where: {
      user_symbol_unique: { userId, symbol },
    },
    create: {
      userId,
      symbol,
      balance: baseUnitAmount,
      decimals,
    },
    update: {
      balance: { increment: baseUnitAmount },
    },
  });
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate auth cookie string for supertest
 */
export function getAuthCookie(token: string): string {
  return `token=${token}`;
}

/**
 * Clean up all test data for a user
 */
export async function cleanupTestData(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await deleteTestUser(userId);
  }
}

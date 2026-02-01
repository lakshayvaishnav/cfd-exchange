/**
 * Mock database module for Jest tests
 * Uses the generated Prisma client from the database package
 */
import { PrismaClient } from "@repo/database/generated/prisma";
import dotenv from "dotenv";
import path from "path";

// Load environment from tests directory
dotenv.config({ path: path.join(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

// Create a singleton Prisma client for testing
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export { prisma };

/**
 * Mock Redis module for Jest tests
 * This creates a Redis client that works with CommonJS Jest
 */
import { createClient } from "redis";
import dotenv from "dotenv";
import path from "path";

// Load environment from tests directory
dotenv.config({ path: path.join(__dirname, "../../.env") });

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Create singleton Redis client for testing
const redis = createClient({
  url: redisUrl,
});

// Auto-connect
redis.connect().catch((err) => {
  console.warn("Redis connection failed:", err.message);
});

export { redis };

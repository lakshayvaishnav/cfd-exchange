/**
 * Vitest setup - runs before each test file
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Verify environment
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not found. Some tests may fail.");
}

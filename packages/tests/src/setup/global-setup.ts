/**
 * Global setup - runs once before all tests
 */
import * as dotenv from "dotenv";
import * as path from "path";

export default async function globalSetup() {
  console.log("\n🚀 Starting test suite setup...");

  // Load environment variables
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });

  // Verify database connection string
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env");
  }

  console.log("✅ Environment variables verified");
  console.log("✅ Test suite setup complete\n");
}

/**
 * Jest setup - runs before each test file
 */
import * as dotenv from "dotenv";
import * as path from "path";

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Set test timeout
jest.setTimeout(30000);

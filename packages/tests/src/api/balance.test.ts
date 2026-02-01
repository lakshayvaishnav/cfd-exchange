/**
 * Balance API Tests
 * Tests for getBalance, getBalanceByAsset, and depositBalance endpoints
 */
import request from "supertest";
import { createTestApp } from "../setup/test-app";
import { createTestUser, deleteTestUser, getAuthCookie, createTestDeposit, TestUser, getPrisma } from "../setup/test-utils";
import { balanceFixtures, depositFixtures } from "../fixtures/prices";

const app = createTestApp();

describe("Balance API", () => {
  const testUsers: string[] = [];

  afterAll(async () => {
    // Cleanup all test users
    for (const userId of testUsers) {
      await deleteTestUser(userId);
    }
  });

  describe("GET /balance", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `balance-get-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);
    });

    it("should return empty balances for new user", async () => {
      const response = await request(app).get("/balance").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.balances).toBeDefined();
      expect(Array.isArray(response.body.balances)).toBe(true);
    });

    it("should return balances after deposit", async () => {
      // Create a deposit
      await createTestDeposit(testUser.id, "USDC", 1000, 2);

      const response = await request(app).get("/balance").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.balances.length).toBeGreaterThan(0);

      const usdcBalance = response.body.balances.find((b: any) => b.symbol === "USDC");
      expect(usdcBalance).toBeDefined();
      expect(usdcBalance.balance).toBe(100000); // 1000 * 100 (2 decimals)
      expect(usdcBalance.decimals).toBe(2);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/balance").expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Authentication required");
    });
  });

  describe("GET /balance/:symbol", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `balance-symbol-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);

      // Create deposits for testing
      await createTestDeposit(testUser.id, "USDC", 500, 2);
      await createTestDeposit(testUser.id, "BTC", 0.5, 8);
    });

    it("should return USDC balance", async () => {
      const response = await request(app).get("/balance/USDC").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.symbol).toBe("USDC");
      expect(response.body.balance).toBe(50000); // 500 * 100
      expect(response.body.decimals).toBe(2);
    });

    it("should return BTC balance", async () => {
      const response = await request(app).get("/balance/BTC").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.symbol).toBe("BTC");
      expect(response.body.balance).toBe(50000000); // 0.5 * 10^8
      expect(response.body.decimals).toBe(8);
    });

    it('should return "asset not found" for symbol user does not have', async () => {
      // Create a new user with no assets
      const newUser = await createTestUser({
        email: `asset-not-found-test-${Date.now()}@test.com`,
      });
      testUsers.push(newUser.id);

      // Try to get USDC balance (user has no assets)
      const response = await request(app).get("/balance/USDC").set("Cookie", getAuthCookie(newUser.token)).expect(200);

      expect(response.body).toBe("asset not found");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/balance/USDC").expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("POST /balance/deposit", () => {
    let testUser: TestUser;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: `balance-deposit-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      });
      testUsers.push(testUser.id);
    });

    it("should deposit USDC with default decimals", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "USDC",
          amount: 1000,
        })
        .expect(200);

      expect(response.body.symbol).toBe("USDC");
      expect(response.body.balance).toBe(100000); // 1000 * 100
      expect(response.body.decimals).toBe(2);
    });

    it("should deposit BTC with default decimals", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "BTC",
          amount: 1.5,
        })
        .expect(200);

      expect(response.body.symbol).toBe("BTC");
      expect(response.body.balance).toBe(150000000); // 1.5 * 10^8
      expect(response.body.decimals).toBe(8);
    });

    it("should deposit with custom decimals", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "USDC",
          amount: 100,
          decimals: 4,
        })
        .expect(200);

      expect(response.body.symbol).toBe("USDC");
      expect(response.body.balance).toBe(1000000); // 100 * 10^4
      expect(response.body.decimals).toBe(4);
    });

    it("should increment balance on multiple deposits", async () => {
      // First deposit
      await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "USDC",
          amount: 500,
        })
        .expect(200);

      // Second deposit
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "USDC",
          amount: 300,
        })
        .expect(200);

      expect(response.body.balance).toBe(80000); // (500 + 300) * 100
    });

    it("should fail deposit with invalid symbol", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "INVALID",
          amount: 100,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail deposit with missing amount", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "USDC",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail deposit with missing symbol", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          amount: 100,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .send({
          symbol: "USDC",
          amount: 100,
        })
        .expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("Balance Decimal Precision", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `balance-precision-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);
    });

    it("should handle small decimal amounts correctly", async () => {
      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(testUser.token))
        .send({
          symbol: "BTC",
          amount: 0.00001234,
        })
        .expect(200);

      expect(response.body.symbol).toBe("BTC");
      // 0.00001234 * 10^8 = 1234
      expect(response.body.balance).toBe(1234);
    });

    it("should handle large amounts correctly", async () => {
      const newUser = await createTestUser({
        email: `balance-large-${Date.now()}@test.com`,
      });
      testUsers.push(newUser.id);

      const response = await request(app)
        .post("/balance/deposit")
        .set("Cookie", getAuthCookie(newUser.token))
        .send({
          symbol: "USDC",
          amount: 1000000, // 1 million USDC
        })
        .expect(200);

      expect(response.body.balance).toBe(100000000); // 1M * 100
    });
  });
});

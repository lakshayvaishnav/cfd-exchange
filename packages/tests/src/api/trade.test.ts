/**
 * Trade API Tests
 * Tests for createOrder, closeOrder, getOrders, and getOrderById endpoints
 */
import request from "supertest";
import { createTestApp } from "../setup/test-app";
import { createTestUser, deleteTestUser, getAuthCookie, createTestDeposit, TestUser, getPrisma } from "../setup/test-utils";
import { validLongOrder, validShortOrder, orderWithTakeProfit, orderWithStopLoss, orderWithBothTPSL, invalidOrders } from "../fixtures/orders";

const app = createTestApp();
const prisma = getPrisma();

describe("Trade API", () => {
  const testUsers: string[] = [];

  afterAll(async () => {
    // Cleanup all test users
    for (const userId of testUsers) {
      await deleteTestUser(userId);
    }
  });

  describe("POST /trade/open", () => {
    let testUser: TestUser;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: `trade-open-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
      });
      testUsers.push(testUser.id);

      // Give user sufficient balance
      await createTestDeposit(testUser.id, "USDC", 10000, 2);
    });

    it("should create a long order with sufficient balance", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(validLongOrder).expect(200);

      expect(response.body.message).toBe("Order created");
      expect(response.body.orderId).toBeDefined();
      expect(typeof response.body.orderId).toBe("string");
    });

    it("should create a short order with sufficient balance", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(validShortOrder).expect(200);

      expect(response.body.message).toBe("Order created");
      expect(response.body.orderId).toBeDefined();
    });

    it("should create an order with leverage", async () => {
      const orderWithLeverage = {
        ...validLongOrder,
        leverage: 20,
      };

      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(orderWithLeverage).expect(200);

      expect(response.body.message).toBe("Order created");
      expect(response.body.orderId).toBeDefined();
    });

    it("should create an order with take-profit", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(orderWithTakeProfit).expect(200);

      expect(response.body.message).toBe("Order created");
      expect(response.body.orderId).toBeDefined();
    });

    it("should create an order with stop-loss", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(orderWithStopLoss).expect(200);

      expect(response.body.message).toBe("Order created");
      expect(response.body.orderId).toBeDefined();
    });

    it("should create an order with both TP and SL", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(orderWithBothTPSL).expect(200);

      expect(response.body.message).toBe("Order created");
      expect(response.body.orderId).toBeDefined();
    });

    it("should fail with missing asset", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(invalidOrders.missingAsset).expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail with missing side", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(invalidOrders.missingSide).expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail with invalid side value", async () => {
      const response = await request(app).post("/trade/open").set("Cookie", getAuthCookie(testUser.token)).send(invalidOrders.invalidSide).expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/trade/open").send(validLongOrder).expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("POST /trade/close/:orderId", () => {
    let testUser: TestUser;
    let orderId: string;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `trade-close-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);

      // Create a test order directly in DB
      const order = await prisma.order.create({
        data: {
          userId: testUser.id,
          side: "long",
          pnl: 0,
          decimals: 4,
          openingPrice: 1000000000, // $100,000 in base units
          closingPrice: 0,
          status: "open",
          qty: 10, // 0.1 BTC
          qtyDecimals: 2,
          leverage: 10,
          margin: 10000000, // $1,000
        },
      });
      orderId = order.id;
    });

    it("should close an open order", async () => {
      const response = await request(app).post(`/trade/close/${orderId}`).set("Cookie", getAuthCookie(testUser.token)).send({ closeReason: "Manual" }).expect(200);

      expect(response.body.message).toBe("Order closed successfully");
      expect(response.body.orderId).toBe(orderId);
    });

    it("should fail to close non-existent order", async () => {
      const fakeOrderId = "00000000-0000-0000-0000-000000000000";

      const response = await request(app).post(`/trade/close/${fakeOrderId}`).set("Cookie", getAuthCookie(testUser.token)).send({ closeReason: "Manual" }).expect(404);

      expect(response.body.error).toBe("Order not found or already closed");
    });

    it("should fail to close order belonging to another user", async () => {
      // Create another user
      const anotherUser = await createTestUser({
        email: `trade-close-other-${Date.now()}@test.com`,
      });
      testUsers.push(anotherUser.id);

      // Create an order for the other user
      const otherOrder = await prisma.order.create({
        data: {
          userId: anotherUser.id,
          side: "short",
          pnl: 0,
          decimals: 4,
          openingPrice: 1000000000,
          closingPrice: 0,
          status: "open",
          qty: 10,
          qtyDecimals: 2,
          leverage: 5,
          margin: 20000000,
        },
      });

      // Try to close with different user
      const response = await request(app).post(`/trade/close/${otherOrder.id}`).set("Cookie", getAuthCookie(testUser.token)).send({ closeReason: "Manual" }).expect(404);

      expect(response.body.error).toBe("Order not found or already closed");
    });

    it("should require authentication", async () => {
      const response = await request(app).post(`/trade/close/${orderId}`).send({ closeReason: "Manual" }).expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("GET /trade/orders", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `trade-orders-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);

      // Create some test orders
      await prisma.order.createMany({
        data: [
          {
            userId: testUser.id,
            side: "long",
            pnl: 50000, // +$5 profit
            decimals: 4,
            openingPrice: 1000000000,
            closingPrice: 1005000000,
            status: "closed",
            qty: 10,
            qtyDecimals: 2,
            leverage: 10,
            margin: 10000000,
            closeReason: "Manual",
          },
          {
            userId: testUser.id,
            side: "short",
            pnl: -30000, // -$3 loss
            decimals: 4,
            openingPrice: 1000000000,
            closingPrice: 1003000000,
            status: "closed",
            qty: 5,
            qtyDecimals: 2,
            leverage: 5,
            margin: 10000000,
            closeReason: "StopLoss",
          },
          {
            userId: testUser.id,
            side: "long",
            pnl: 0,
            decimals: 4,
            openingPrice: 1000000000,
            closingPrice: 0,
            status: "open",
            qty: 20,
            qtyDecimals: 2,
            leverage: 10,
            margin: 20000000,
          },
        ],
      });
    });

    it("should return all orders for user", async () => {
      const response = await request(app).get("/trade/orders").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.orders).toBeDefined();
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.orders.length).toBe(3);
    });

    it("should return orders in descending order by createdAt", async () => {
      const response = await request(app).get("/trade/orders").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      const orders = response.body.orders;
      for (let i = 1; i < orders.length; i++) {
        const prevDate = new Date(orders[i - 1].createdAt).getTime();
        const currDate = new Date(orders[i].createdAt).getTime();
        expect(prevDate).toBeGreaterThanOrEqual(currDate);
      }
    });

    it("should transform order data correctly", async () => {
      const response = await request(app).get("/trade/orders").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      const order = response.body.orders[0];
      expect(order).toHaveProperty("id");
      expect(order).toHaveProperty("symbol");
      expect(order).toHaveProperty("orderType");
      expect(order).toHaveProperty("quantity");
      expect(order).toHaveProperty("price");
      expect(order).toHaveProperty("status");
      expect(order).toHaveProperty("pnl");
      expect(order).toHaveProperty("createdAt");
      expect(order).toHaveProperty("leverage");
    });

    it("should return empty array for user with no orders", async () => {
      const newUser = await createTestUser({
        email: `trade-orders-empty-${Date.now()}@test.com`,
      });
      testUsers.push(newUser.id);

      const response = await request(app).get("/trade/orders").set("Cookie", getAuthCookie(newUser.token)).expect(200);

      expect(response.body.orders).toEqual([]);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/trade/orders").expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("GET /trade/orders/:orderId", () => {
    let testUser: TestUser;
    let orderId: string;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `trade-order-id-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);

      const order = await prisma.order.create({
        data: {
          userId: testUser.id,
          side: "long",
          pnl: 100000, // +$10
          decimals: 4,
          openingPrice: 1000000000, // $100,000
          closingPrice: 1010000000, // $101,000
          status: "closed",
          qty: 10, // 0.1 BTC
          qtyDecimals: 2,
          leverage: 10,
          margin: 10000000,
          takeProfit: 1100000000, // $110,000
          stopLoss: 900000000, // $90,000
          closeReason: "TakeProfit",
        },
      });
      orderId = order.id;
    });

    it("should return order by ID", async () => {
      const response = await request(app).get(`/trade/orders/${orderId}`).set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.order).toBeDefined();
      expect(response.body.order.id).toBe(orderId);
      expect(response.body.order.orderType).toBe("long");
      expect(response.body.order.quantity).toBe(0.1);
      expect(response.body.order.price).toBe(100000);
      expect(response.body.order.pnl).toBe(10);
      expect(response.body.order.leverage).toBe(10);
      expect(response.body.order.takeProfit).toBe(110000);
      expect(response.body.order.stopLoss).toBe(90000);
      expect(response.body.order.closeReason).toBe("TakeProfit");
    });

    it("should return 404 for non-existent order", async () => {
      const fakeOrderId = "00000000-0000-0000-0000-000000000000";

      const response = await request(app).get(`/trade/orders/${fakeOrderId}`).set("Cookie", getAuthCookie(testUser.token)).expect(404);

      expect(response.body.error).toBe("Order not found");
    });

    it("should not return order belonging to another user", async () => {
      const anotherUser = await createTestUser({
        email: `trade-order-id-other-${Date.now()}@test.com`,
      });
      testUsers.push(anotherUser.id);

      const response = await request(app).get(`/trade/orders/${orderId}`).set("Cookie", getAuthCookie(anotherUser.token)).expect(404);

      expect(response.body.error).toBe("Order not found");
    });

    it("should require authentication", async () => {
      const response = await request(app).get(`/trade/orders/${orderId}`).expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("Multiple Orders For Same User", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `trade-multiple-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);
      await createTestDeposit(testUser.id, "USDC", 100000, 2);
    });

    it("should allow multiple concurrent orders", async () => {
      const orderPromises = [];

      // Create 5 orders concurrently
      for (let i = 0; i < 5; i++) {
        orderPromises.push(
          request(app)
            .post("/trade/open")
            .set("Cookie", getAuthCookie(testUser.token))
            .send({
              asset: "BTC",
              side: i % 2 === 0 ? "long" : "short",
              status: "open",
              qty: 0.01,
              leverage: 5,
            }),
        );
      }

      const responses = await Promise.all(orderPromises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.orderId).toBeDefined();
      });

      // All order IDs should be unique
      const orderIds = responses.map((r) => r.body.orderId);
      const uniqueIds = new Set(orderIds);
      expect(uniqueIds.size).toBe(5);
    });
  });
});

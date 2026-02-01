/**
 * Authentication API Tests
 * Tests for login, register, logout, and me endpoints
 */
import request from "supertest";
import { createTestApp } from "../setup/test-app";
import { createTestUser, deleteTestUser, getAuthCookie, TestUser } from "../setup/test-utils";

const app = createTestApp();

describe("Authentication API", () => {
  const testUsers: string[] = [];

  afterAll(async () => {
    // Cleanup all test users
    for (const userId of testUsers) {
      await deleteTestUser(userId);
    }
  });

  describe("POST /auth/register", () => {
    it("should register a new user with valid credentials", async () => {
      const timestamp = Date.now();
      const userData = {
        email: `register-test-${timestamp}@test.com`,
        name: "Register Test User",
        password: "password123",
      };

      const response = await request(app).post("/auth/register").send(userData).expect(200);

      expect(response.body.message).toBe("User created successfully");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.id).toBeDefined();

      // Track for cleanup
      testUsers.push(response.body.user.id);

      // Should set auth cookie
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("token=");
    });

    it("should fail to register with missing email", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          name: "Test User",
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail to register with missing name", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "test@test.com",
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail to register with missing password", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "test@test.com",
          name: "Test User",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail to register with invalid email format", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "invalid-email",
          name: "Test User",
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail to register with duplicate email", async () => {
      const timestamp = Date.now();
      const userData = {
        email: `duplicate-test-${timestamp}@test.com`,
        name: "Duplicate Test User",
        password: "password123",
      };

      // First registration
      const firstResponse = await request(app).post("/auth/register").send(userData).expect(200);

      testUsers.push(firstResponse.body.user.id);

      // Second registration with same email
      const response = await request(app).post("/auth/register").send(userData).expect(409);

      expect(response.body.error).toBe("user already exists");
    });
  });

  describe("POST /auth/login", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `login-test-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);
    });

    it("should login with valid credentials", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.message).toBe("User logged in successfully");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);

      // Should set auth cookie
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("token=");
    });

    it("should fail login with wrong password", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body.error).toBe("Unauthorized");
    });

    it("should fail login with non-existent user", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "nonexistent@test.com",
          password: "password123",
        })
        .expect(404);

      expect(response.body.error).toBe("User not found");
    });

    it("should fail login with missing email", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail login with missing password", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it("should fail login with invalid email format", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "invalid-email",
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout and clear cookie", async () => {
      const response = await request(app).post("/auth/logout").expect(200);

      expect(response.body.message).toBe("Logout successful");

      // Should clear auth cookie
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      // Cookie should be cleared (expires in the past or empty value)
      expect(cookies[0]).toContain("token=");
    });
  });

  describe("GET /auth/me", () => {
    let testUser: TestUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: `me-test-${Date.now()}@test.com`,
      });
      testUsers.push(testUser.id);
    });

    it("should return user data when authenticated", async () => {
      const response = await request(app).get("/auth/me").set("Cookie", getAuthCookie(testUser.token)).expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/auth/me").expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Authentication required");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app).get("/auth/me").set("Cookie", "token=invalid-token").expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Invalid token");
    });

    it("should return 401 with expired token", async () => {
      // Create an expired token
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        "secret",
        { expiresIn: "-1h" }, // Already expired
      );

      const response = await request(app).get("/auth/me").set("Cookie", `token=${expiredToken}`).expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Token expired");
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });
  });
});

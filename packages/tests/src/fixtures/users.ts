/**
 * Test fixtures for user data
 */

export const validUserData = {
  email: "test@example.com",
  name: "Test User",
  password: "password123",
};

export const invalidUserData = {
  missingEmail: {
    name: "Test User",
    password: "password123",
  },
  missingName: {
    email: "test@example.com",
    password: "password123",
  },
  missingPassword: {
    email: "test@example.com",
    name: "Test User",
  },
  invalidEmail: {
    email: "invalid-email",
    name: "Test User",
    password: "password123",
  },
};

export const loginCredentials = {
  valid: {
    email: "test@example.com",
    password: "password123",
  },
  wrongPassword: {
    email: "test@example.com",
    password: "wrongpassword",
  },
  nonExistentUser: {
    email: "nonexistent@example.com",
    password: "password123",
  },
};

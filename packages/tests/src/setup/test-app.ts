/**
 * Test app factory - creates an Express app for testing
 * This mirrors the api-service setup for integration testing
 */
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@repo/database";
import { redis } from "@repo/redis";

const JWT_SECRET = "secret";

// ================ SCHEMAS ================

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RegisterSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
});

const DepositBalanceBodySchema = z.object({
  symbol: z.enum(["USDC", "BTC"]),
  amount: z.number(),
  decimals: z.number().optional(),
});

const GetBalanceByAssetParamsSchema = z.object({
  symbol: z.string(),
});

const CreateOrderBodySchema = z.object({
  status: z.enum(["open", "closed"]).optional().default("open"),
  asset: z.string(),
  side: z.enum(["long", "short"]),
  qty: z.coerce.number(),
  leverage: z.coerce.number(),
  takeProfit: z.coerce.number().optional(),
  stopLoss: z.coerce.number().optional(),
});

const CloseOrderBodySchema = z.object({
  pnl: z.coerce.number().optional(),
  closeReason: z.enum(["TakeProfit", "StopLoss", "Manual", "Liquidation"]).optional(),
});

// ================ JWT PAYLOAD ================

interface JwtPayload {
  id: string;
  email: string;
}

// ================ EXTEND EXPRESS REQUEST ================

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

// ================ MIDDLEWARE ================

async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.status(401).json({ status: "error", message: "Authentication required" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true },
    });

    if (!user) {
      res.status(401).json({ status: "error", message: "User not found or inactive" });
      return;
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ status: "error", message: "Token expired" });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ status: "error", message: "Invalid token" });
      return;
    }
    next(err);
  }
}

// ================ AUTH CONTROLLER ================

const login = async (req: Request, res: Response) => {
  try {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (password !== user.password) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 60 * 60 * 1000,
    });

    res.json({
      message: "User logged in successfully",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const register = async (req: Request, res: Response) => {
  try {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }

    const { name, email, password } = result.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: "user already exists" });
    }

    const newUser = await prisma.user.create({
      data: { email, name, password },
    });

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 60 * 60 * 1000,
    });

    res.json({
      message: "User created successfully",
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const logout = (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  res.json({ message: "Logout successful" });
};

const me = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true },
    });

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: userData });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// ================ BALANCE CONTROLLER ================

const getBalance = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.json("user not found");
  }

  const balances = await prisma.asset.findMany({
    where: { userId },
    select: { symbol: true, balance: true, decimals: true },
  });

  res.json({ userId, balances });
};

const getBalanceByAsset = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.json("user not found");
  }

  const result = GetBalanceByAssetParamsSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({ error: result.error.message });
  }

  const { symbol } = result.data;

  const record = await prisma.asset.findUnique({
    where: { user_symbol_unique: { userId, symbol: symbol as any } },
    select: { symbol: true, balance: true, decimals: true },
  });

  if (!record) return res.json("asset not found");

  res.json(record);
};

const depositBalance = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.json("user not found");
  }

  const result = DepositBalanceBodySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.message });
  }

  const { symbol, amount, decimals } = result.data;

  const decimalPlaces = decimals ?? (symbol === "USDC" ? 2 : 8);
  const baseUnitAmount = Math.round(amount * Math.pow(10, decimalPlaces));

  const updated = await prisma.asset.upsert({
    where: { user_symbol_unique: { userId, symbol } },
    create: { userId, symbol, balance: baseUnitAmount, decimals: decimalPlaces },
    update: { balance: { increment: baseUnitAmount } },
    select: { symbol: true, balance: true, decimals: true },
  });

  // Try to publish to Redis, but don't fail the request if Redis is unavailable
  try {
    await redis.xadd(
      "engine-stream",
      "*",
      "data",
      JSON.stringify({
        kind: "balance-update",
        payload: {
          userId,
          symbol,
          newBalance: updated.balance,
          decimals: updated.decimals,
        },
      }),
    );
  } catch (err) {
    // Redis not available in test environment, ignore
    console.warn("Redis publish failed:", err);
  }

  res.json(updated);
};

// ================ TRADE CONTROLLER ================

const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json("user not found");
    }

    const result = CreateOrderBodySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }

    const id = crypto.randomUUID();

    // For testing, we'll directly return success
    // In production, this would wait for engine response via Redis
    res.json({ message: "Order created", orderId: id });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const closeOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "user not found" });
    }

    const { orderId } = req.params as { orderId: string };
    const result = CloseOrderBodySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, userId, status: "open" },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found or already closed" });
    }

    res.json({ message: "Order closed successfully", orderId });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "user not found" });
    }

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const transformedOrders = orders.map((order: any) => ({
      id: order.id,
      symbol: "BTC",
      orderType: order.side === "long" ? "long" : "short",
      quantity: order.qty / 100,
      price: order.openingPrice / 10000,
      status: order.status,
      pnl: order.pnl / 10000,
      createdAt: order.createdAt.toISOString(),
      closedAt: order.closedAt?.toISOString(),
      exitPrice: order.closingPrice ? order.closingPrice / 10000 : undefined,
      leverage: order.leverage,
      takeProfit: order.takeProfit ? order.takeProfit / 10000 : undefined,
      stopLoss: order.stopLoss ? order.stopLoss / 10000 : undefined,
      closeReason: order.closeReason,
    }));

    res.json({ orders: transformedOrders });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getOrderById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "user not found" });
    }

    const { orderId } = req.params as { orderId: string };

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const transformedOrder = {
      id: order.id,
      symbol: "BTC",
      orderType: order.side === "long" ? "long" : "short",
      quantity: order.qty / 100,
      price: order.openingPrice / 10000,
      status: order.status,
      pnl: order.pnl / 10000,
      createdAt: order.createdAt.toISOString(),
      closedAt: order.closedAt?.toISOString(),
      exitPrice: order.closingPrice ? order.closingPrice / 10000 : undefined,
      leverage: order.leverage,
      takeProfit: order.takeProfit ? order.takeProfit / 10000 : undefined,
      stopLoss: order.stopLoss ? order.stopLoss / 10000 : undefined,
      closeReason: order.closeReason,
    };

    res.json({ order: transformedOrder });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// ================ CREATE APP ================

export function createTestApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.post("/auth/login", login);
  app.post("/auth/register", register);
  app.post("/auth/logout", logout);
  app.get("/auth/me", authenticate, me);

  // Balance routes
  app.get("/balance", authenticate, getBalance);
  app.get("/balance/:symbol", authenticate, getBalanceByAsset);
  app.post("/balance/deposit", authenticate, depositBalance);

  // Trade routes
  app.post("/trade/open", authenticate, createOrder);
  app.post("/trade/close/:orderId", authenticate, closeOrder);
  app.get("/trade/orders", authenticate, getOrders);
  app.get("/trade/orders/:orderId", authenticate, getOrderById);

  return app;
}

export default createTestApp;

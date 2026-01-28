import dotenv from "dotenv";
dotenv.config();

import { redis } from "@repo/redis";
import { prisma } from "@repo/database";

const client = redis.duplicate();

type UserBalances = Record<string, number>;

interface Order {
  id: string;
  userId: string;
  asset: string;
  side: "long" | "short";
  qty: number;
  leverage?: number;
  openingPrice: number;
  createdAt: number;
  status: string;
  takeProfit?: number;
  stopLoss?: number;
}

let open_orders: Order[] = [];
let balances: Record<string, UserBalances> = {};
let prices: Record<string, number> = {};
let bidPrices: Record<string, number> = {};
let askPrices: Record<string, number> = {};

let lastId = "$";

const CALLBACK_QUEUE = "callback-queue";
const ENGINE_STREAM = "engine_stream";

function safeNum(n: any, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function getFieldValue(fields: string[], key: string) {
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] == key) return fields[i + 1];
  }

  return undefined;
}

async function updateBalanceInDatabase(
  userId: string,
  symbol: string,
  newBalanceFloat: number,
) {
  try {
    await prisma.asset.upsert({
      where: { user_symbol_unique: { userId, symbol: symbol as any } },
      create: {
        userId,
        symbol: symbol as any,
        balance: Math.round(newBalanceFloat * 100), // stored in cents
        decimals: 2,
      },
      update: { balance: Math.round(newBalanceFloat * 100) },
    });
    console.log(`Updated ${symbol} balance for ${userId}: ${newBalanceFloat}`);
  } catch (error) {
    console.error(`Failed to update balance for ${userId}:`, error);
  }
}

function getMemBalance(
  userId: string,
  symbol: string,
  snapshot?: Array<{ symbol: string; balance: number; decimals: number }>,
) {
  if (!balances[userId]) balances[userId] = {};

  if (snapshot) {
    const snap = snapshot.find((a) => a.symbol === symbol);

    if (snap) {
      const decimals = snap.decimals ?? 2;
      const val = snap.balance / 10 ** decimals;
      balances[userId][symbol] = val;
      return val;
    }
  }

  return balances[userId][symbol];
}

function setMemBalance(userId: string, symbol: string, newVal: number) {
  if (!balances[userId]) balances[userId] = {};
  balances[userId][symbol] = newVal;
  return newVal;
}

async function checkLiquidations() {
  for (let i = open_orders.length - 1; i >= 0; i--) {
    const order = open_orders[i];

    if (!order) continue;

    const symbol = order.asset;
  }
}

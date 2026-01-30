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

async function processOrderLiquidation (
    order : Order,
    currentPriceForOrder: number,
    context : string = "price-update"
) {
    if (!currentPriceForOrder || !Number.isFinite(currentPriceForOrder) || currentPriceForOrder <= 0) {
        console.log(`${context}: Invalid price for order ${order.id}, skipping liquidation check`)
        return {liquidated : false, pnl : 0};
    }

    const pnl = order.side === "long" ? (currentPriceForOrder - order.openingPrice) * order.qty : (order.openingPrice - currentPriceForOrder) * order.qty

    if(!Number.isFinite(pnl)) return {liquidated : false, pnl : 0}

    let reason: "TakeProfit" | "StopLoss" | "margin" | undefined;

    // TP
    if (!reason && order.takeProfit && order.takeProfit > 0) {
      const hit = order.side === "long"
      ? currentPriceForOrder >= order.takeProfit
      : currentPriceForOrder <= order.takeProfit;

      if(hit) {
        reason = "TakeProfit";
        console.log(`${context}: Take Profit hit order ${order.id} (${order.side} : price ${currentPriceForOrder} vs TP ${order.takeProfit})`)
      }
    }

    // SL
    
}

async function checkLiquidations() {
  for (let i = open_orders.length - 1; i >= 0; i--) {
    const order = open_orders[i];

    if (!order) continue;

    const symbol = order.asset;
    const currentBidPrice = bidPrices[symbol];
    const currentAskPrice = askPrices[symbol];

    // skip if we don't have valid price data for this asset
    if (!currentBidPrice || !currentAskPrice) continue;

    const currentPriceForOrder =
      order.side === "long" ? currentBidPrice : currentAskPrice;

    // process order liquidation....
  }
}

async function loadSnapshot() {
  try {
    const dbOrders = await prisma.order.findMany({ where: { status: "open" } });

    open_orders = dbOrders.map((order: any) => ({
      id: order.id,
      userId: order.userId,
      asset: "BTC",
      side: order.side as "long" | "short",
      qty: order.qty / 100,,
      leverage : order.leverage,
      openingPrice: order.openingPrice / 10000,
      createdAt : order.createdAt.getTime(),
      status : "open",
      takeProfit: (order.takeProfit && order.takeProfit > 0) ? order.takeProfit / 10000 : undefined,
      stopLoss: (order.stopLoss && order.stopLoss > 0) ? order.stopLoss /10000 : undefined,
    }));

     console.log(`loaded ${open_orders.length} open orders from the database`);
    console.log("Order IDs loaded:", open_orders.map((o) => `${o.id.slice(0, 8)}...`));

    balances = {};
  } catch (error) {
    console.log(error)
  }
}



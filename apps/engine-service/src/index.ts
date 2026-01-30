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

async function updateBalanceInDatabase(userId: string, symbol: string, newBalanceFloat: number) {
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

function getMemBalance(userId: string, symbol: string, snapshot?: Array<{ symbol: string; balance: number; decimals: number }>) {
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

async function createSnapshot() {
  try {
    for (const order of open_orders) {
      const symbol = order.asset;
      const currentBidPrice = bidPrices[symbol];
      const currentAskPrice = askPrices[symbol];

      if (!currentBidPrice || !currentAskPrice) continue;

      let currentPnl = 0;
      if (currentBidPrice && currentAskPrice) {
        const currentPriceForOrder = order.side === "long" ? currentBidPrice : currentAskPrice;
        currentPnl = order.side === "long" ? (currentPriceForOrder - order.openingPrice) * order.qty : (order.openingPrice - currentPriceForOrder) * order.qty;
      }

      await prisma.order.upsert({
        where: { id: order.id },
        update: {
          side: order.side,
          pnl: Math.round(currentPnl * 10000),
          decimals: 4,
          openingPrice: Math.round(order.openingPrice * 10000),
          closingPrice: 0,
          status: "open",
          qty: Math.round(order.qty * 100),
          qtyDecimals: 2,
          leverage: order.leverage || 1,
          takeProfit: order.takeProfit ? Math.round(order.takeProfit * 10000) : null,
          stopLoss: order.stopLoss ? Math.round(order.stopLoss * 10000) : null,
          margin: Math.round((order.openingPrice * order.qty * 100) / (order.leverage || 1)),
        },
        create: {
          id: order.id,
          userId: order.userId,
          side: order.side,
          pnl: Math.round(currentPnl * 10000),
          decimals: 4,
          openingPrice: Math.round(order.openingPrice * 10000),
          closingPrice: 0,
          status: "open",
          qty: Math.round(order.qty * 100),
          qtyDecimals: 2,
          leverage: order.leverage || 1,
          takeProfit: order.takeProfit ? Math.round(order.takeProfit * 10000) : null,
          stopLoss: order.stopLoss ? Math.round(order.stopLoss * 10000) : null,
          margin: Math.round((order.openingPrice * order.qty * 100) / (order.leverage || 1)),
          createdAt: new Date(order.createdAt),
        } as any,
      });
    }

    await checkLiquidations();

    console.log("snapshot sent");
  } catch (e) {
    console.log(e);
  }
}

/*
it checks three conditions
1. take profit
2. stop loss
3. Margin liquidation (forced close)

if any condition hits
- close the order
- updates the balance
- presists order closure in DB
- emits a callback event

Liquidation here = force-closing a leveraged position when margin is almost gone.
*/
async function processOrderLiquidation(order: Order, currentPriceForOrder: number, context: string = "price-update") {
  if (!currentPriceForOrder || !Number.isFinite(currentPriceForOrder) || currentPriceForOrder <= 0) {
    console.log(`${context}: Invalid price for order ${order.id}, skipping liquidation check`);
    return { liquidated: false, pnl: 0 };
  }

  // long -> price goes up = profit
  // short -> price goes down = profit
  const pnl = order.side === "long" ? (currentPriceForOrder - order.openingPrice) * order.qty : (order.openingPrice - currentPriceForOrder) * order.qty;

  if (!Number.isFinite(pnl)) return { liquidated: false, pnl: 0 };

  let reason: "TakeProfit" | "StopLoss" | "margin" | undefined;

  // TP - controlled exit , not liquidation
  // margin + pnl returned to user.
  if (!reason && order.takeProfit && order.takeProfit > 0) {
    const hit = order.side === "long" ? currentPriceForOrder >= order.takeProfit : currentPriceForOrder <= order.takeProfit;

    if (hit) {
      reason = "TakeProfit";
      console.log(`${context}: Take Profit hit order ${order.id} (${order.side} : price ${currentPriceForOrder} vs TP ${order.takeProfit})`);
    }
  }

  // SL
  if (!reason && order.stopLoss && order.stopLoss > 0) {
    const hit = order.side === "long" ? currentPriceForOrder <= order.stopLoss : currentPriceForOrder >= order.stopLoss;

    if (hit) {
      reason = "StopLoss";
      console.log(`${context}: Stop loss hit for order ${order.id} (${order.side}): price ${currentPriceForOrder} vs SL ${order.stopLoss}`);
    }
  }

  if (!reason && order.leverage) {
    const initialMargin = (order.openingPrice * order.qty) / order.leverage;
    const remainingMargin = initialMargin + pnl;
    const liquidationThreshold = initialMargin * 0.05;

    if (remainingMargin <= liquidationThreshold) {
      reason = "margin";
      console.log(`${context} liquidation: order ${order.id} liquidated (remaining: ${remainingMargin}, threshold: ${liquidationThreshold})`);
    }
  }

  if (!reason) return { liquidated: false, pnl };

  if (!balances[order.userId]) balances[order.userId] = {};

  if (reason === "margin") {
    const initialMargin = (order.openingPrice * order.qty) / (order.leverage || 1);
    const remainingMargin = Math.max(0, initialMargin + pnl);
    const newBal = setMemBalance(order.userId, "USDC", (balances[order.userId]?.USDC || 0) + remainingMargin);
    await updateBalanceInDatabase(order.userId, "USDC", newBal);
    console.log(`Liquidated order ${order.id}: remaining margin = ${remainingMargin}`);
  } else {
    const initialMargin = (order.openingPrice * order.qty) / (order.leverage || 1);
    const credit = initialMargin + pnl;
    const newBal = setMemBalance(order.userId, "USDC", (balances[order.userId]?.USDC || 0) + credit);
    await updateBalanceInDatabase(order.userId, "USDC", newBal);
    console.log(`Closed order ${order.id} (${reason}): returned ${credit}`);
  }

  try {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "closed",
        pnl: Math.round(pnl * 10000),
        closingPrice: Math.round(currentPriceForOrder * 10000),
        closedAt: new Date(),
        closeReason: reason as any,
      },
    });
  } catch (error) {
    console.log(`error on ${context} closing:`, error);
  }

  await client
    .xadd(CALLBACK_QUEUE, "*", "id", order.id, "status", "closed", "reason", reason, "pnl", pnl.toString())
    .catch((err) => console.error(`Failed to send ${context} liquidation callback: `, err));

  return { liquidated: true, pnl, reason };
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

    const currentPriceForOrder = order.side === "long" ? currentBidPrice : currentAskPrice;

    const result = await processOrderLiquidation(order, currentPriceForOrder, "preodic-check");
    if (result.liquidated) open_orders.splice(i, 1);
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
      qty: order.qty / 100,
      leverage: order.leverage,
      openingPrice: order.openingPrice / 10000,
      createdAt: order.createdAt.getTime(),
      status: "open",
      takeProfit: order.takeProfit && order.takeProfit > 0 ? order.takeProfit / 10000 : undefined,
      stopLoss: order.stopLoss && order.stopLoss > 0 ? order.stopLoss / 10000 : undefined,
    }));

    console.log(`loaded ${open_orders.length} open orders from the database`);
    console.log(
      "Order IDs loaded:",
      open_orders.map((o) => `${o.id.slice(0, 8)}...`),
    );

    balances = {};
  } catch (error) {
    console.log(error);
  }
}

setInterval(createSnapshot, 10000);

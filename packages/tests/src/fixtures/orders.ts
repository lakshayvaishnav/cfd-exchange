/**
 * Test fixtures for order data
 */

export const validLongOrder = {
  asset: "BTC",
  side: "long" as const,
  status: "open" as const,
  qty: 0.1,
  leverage: 10,
};

export const validShortOrder = {
  asset: "BTC",
  side: "short" as const,
  status: "open" as const,
  qty: 0.05,
  leverage: 5,
};

export const orderWithTakeProfit = {
  asset: "BTC",
  side: "long" as const,
  status: "open" as const,
  qty: 0.1,
  leverage: 10,
  takeProfit: 110000, // Take profit at $110,000
};

export const orderWithStopLoss = {
  asset: "BTC",
  side: "long" as const,
  status: "open" as const,
  qty: 0.1,
  leverage: 10,
  stopLoss: 90000, // Stop loss at $90,000
};

export const orderWithBothTPSL = {
  asset: "BTC",
  side: "long" as const,
  status: "open" as const,
  qty: 0.1,
  leverage: 10,
  takeProfit: 110000,
  stopLoss: 90000,
};

export const invalidOrders = {
  missingAsset: {
    side: "long",
    status: "open",
    qty: 0.1,
    leverage: 10,
  },
  missingSide: {
    asset: "BTC",
    status: "open",
    qty: 0.1,
    leverage: 10,
  },
  invalidSide: {
    asset: "BTC",
    side: "invalid",
    status: "open",
    qty: 0.1,
    leverage: 10,
  },
  zeroQuantity: {
    asset: "BTC",
    side: "long",
    status: "open",
    qty: 0,
    leverage: 10,
  },
  negativeQuantity: {
    asset: "BTC",
    side: "long",
    status: "open",
    qty: -0.1,
    leverage: 10,
  },
};

export const closeOrderReasons = {
  manual: "Manual" as const,
  takeProfit: "TakeProfit" as const,
  stopLoss: "StopLoss" as const,
  liquidation: "Liquidation" as const,
};

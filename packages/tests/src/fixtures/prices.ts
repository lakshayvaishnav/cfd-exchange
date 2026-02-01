/**
 * Test fixtures for price data
 */

export const btcPrices = {
  // Standard price around $100,000
  standard: {
    bid: 99950,
    ask: 100050,
    mid: 100000,
  },
  // Price increase for long profit scenario
  increased: {
    bid: 104950,
    ask: 105050,
    mid: 105000,
  },
  // Price decrease for short profit scenario
  decreased: {
    bid: 94950,
    ask: 95050,
    mid: 95000,
  },
  // Price for take-profit trigger (long)
  takeProfitTrigger: {
    bid: 110000,
    ask: 110100,
    mid: 110050,
  },
  // Price for stop-loss trigger (long)
  stopLossTrigger: {
    bid: 89900,
    ask: 90000,
    mid: 89950,
  },
  // Price for liquidation scenario
  liquidationPrice: {
    bid: 91000,
    ask: 91100,
    mid: 91050,
  },
};

export const balanceFixtures = {
  // Sufficient balance for trading
  sufficientUSDC: 10000, // $10,000 USDC
  // Insufficient balance
  insufficientUSDC: 10, // $10 USDC
  // Large balance for stress testing
  largeUSDC: 1000000, // $1,000,000 USDC
  // BTC balance
  btcBalance: 1.5, // 1.5 BTC
};

export const depositFixtures = {
  validUSDC: {
    symbol: "USDC" as const,
    amount: 1000,
  },
  validBTC: {
    symbol: "BTC" as const,
    amount: 0.5,
  },
  invalidSymbol: {
    symbol: "INVALID",
    amount: 100,
  },
  negativeAmount: {
    symbol: "USDC",
    amount: -100,
  },
  zeroAmount: {
    symbol: "USDC",
    amount: 0,
  },
};

/**
 * Engine Service Unit Tests
 * Tests for core trading engine logic including margin calculation,
 * PnL calculation, liquidation, and order management
 */

// ================ ENGINE UTILITY FUNCTIONS ================
// These are copied from the engine service for unit testing

function safeNum(n: any, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function getFieldValue(fields: string[], key: string) {
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] === key) return fields[i + 1];
  }
  return undefined;
}

// ================ PNL CALCULATION ================

function calculatePnL(side: "long" | "short", openingPrice: number, currentPrice: number, qty: number): number {
  if (side === "long") {
    return (currentPrice - openingPrice) * qty;
  } else {
    return (openingPrice - currentPrice) * qty;
  }
}

// ================ MARGIN CALCULATION ================

function calculateRequiredMargin(openingPrice: number, qty: number, leverage: number): number {
  return (openingPrice * qty) / leverage;
}

// ================ LIQUIDATION CHECK ================

interface Order {
  id: string;
  userId: string;
  asset: string;
  side: "long" | "short";
  qty: number;
  leverage: number;
  openingPrice: number;
  takeProfit?: number;
  stopLoss?: number;
}

interface LiquidationResult {
  shouldClose: boolean;
  reason?: "TakeProfit" | "StopLoss" | "margin";
  pnl: number;
}

function checkLiquidation(order: Order, currentPrice: number): LiquidationResult {
  const pnl = calculatePnL(order.side, order.openingPrice, currentPrice, order.qty);

  // Check Take Profit
  if (order.takeProfit && order.takeProfit > 0) {
    const hit = order.side === "long" ? currentPrice >= order.takeProfit : currentPrice <= order.takeProfit;

    if (hit) {
      return { shouldClose: true, reason: "TakeProfit", pnl };
    }
  }

  // Check Stop Loss
  if (order.stopLoss && order.stopLoss > 0) {
    const hit = order.side === "long" ? currentPrice <= order.stopLoss : currentPrice >= order.stopLoss;

    if (hit) {
      return { shouldClose: true, reason: "StopLoss", pnl };
    }
  }

  // Check Margin Liquidation (5% threshold)
  if (order.leverage && order.leverage > 1) {
    const initialMargin = (order.openingPrice * order.qty) / order.leverage;
    const remainingMargin = initialMargin + pnl;
    const liquidationThreshold = initialMargin * 0.05;

    if (remainingMargin <= liquidationThreshold) {
      return { shouldClose: true, reason: "margin", pnl };
    }
  }

  return { shouldClose: false, pnl };
}

// ================ TESTS ================

describe("Engine Utility Functions", () => {
  describe("safeNum", () => {
    it("should return the number for valid numeric input", () => {
      expect(safeNum(42)).toBe(42);
      expect(safeNum(3.14)).toBe(3.14);
      expect(safeNum(-100)).toBe(-100);
      expect(safeNum(0)).toBe(0);
    });

    it("should return the number for numeric strings", () => {
      expect(safeNum("42")).toBe(42);
      expect(safeNum("3.14")).toBe(3.14);
      expect(safeNum("-100")).toBe(-100);
    });

    it("should return default for NaN", () => {
      expect(safeNum(NaN)).toBe(0);
      expect(safeNum(NaN, 10)).toBe(10);
    });

    it("should return default for Infinity", () => {
      expect(safeNum(Infinity)).toBe(0);
      expect(safeNum(-Infinity)).toBe(0);
      expect(safeNum(Infinity, 99)).toBe(99);
    });

    it("should return default for non-numeric values", () => {
      expect(safeNum("abc")).toBe(0);
      expect(safeNum(undefined)).toBe(0);
      expect(safeNum(null)).toBe(0);
      expect(safeNum({})).toBe(0);
      expect(safeNum([])).toBe(0);
    });

    it("should use custom default value", () => {
      expect(safeNum("invalid", 42)).toBe(42);
      expect(safeNum(undefined, -1)).toBe(-1);
    });
  });

  describe("getFieldValue", () => {
    it("should return value for existing key", () => {
      const fields = ["name", "John", "age", "30", "city", "NYC"];
      expect(getFieldValue(fields, "name")).toBe("John");
      expect(getFieldValue(fields, "age")).toBe("30");
      expect(getFieldValue(fields, "city")).toBe("NYC");
    });

    it("should return undefined for non-existing key", () => {
      const fields = ["name", "John", "age", "30"];
      expect(getFieldValue(fields, "email")).toBeUndefined();
    });

    it("should handle empty array", () => {
      expect(getFieldValue([], "key")).toBeUndefined();
    });

    it("should handle Redis-style field arrays", () => {
      const redisFields = ["id", "order-123", "status", "created", "pnl", "100.50"];
      expect(getFieldValue(redisFields, "id")).toBe("order-123");
      expect(getFieldValue(redisFields, "status")).toBe("created");
      expect(getFieldValue(redisFields, "pnl")).toBe("100.50");
    });
  });
});

describe("PnL Calculation", () => {
  describe("Long Orders", () => {
    it("should calculate profit when price increases", () => {
      const pnl = calculatePnL("long", 100000, 105000, 1);
      expect(pnl).toBe(5000); // +$5,000 profit
    });

    it("should calculate loss when price decreases", () => {
      const pnl = calculatePnL("long", 100000, 95000, 1);
      expect(pnl).toBe(-5000); // -$5,000 loss
    });

    it("should calculate zero PnL when price unchanged", () => {
      const pnl = calculatePnL("long", 100000, 100000, 1);
      expect(pnl).toBe(0);
    });

    it("should scale PnL by quantity", () => {
      const pnl = calculatePnL("long", 100000, 105000, 0.5);
      expect(pnl).toBe(2500); // Half the profit for half the quantity
    });
  });

  describe("Short Orders", () => {
    it("should calculate profit when price decreases", () => {
      const pnl = calculatePnL("short", 100000, 95000, 1);
      expect(pnl).toBe(5000); // +$5,000 profit (short profits when price drops)
    });

    it("should calculate loss when price increases", () => {
      const pnl = calculatePnL("short", 100000, 105000, 1);
      expect(pnl).toBe(-5000); // -$5,000 loss
    });

    it("should calculate zero PnL when price unchanged", () => {
      const pnl = calculatePnL("short", 100000, 100000, 1);
      expect(pnl).toBe(0);
    });

    it("should scale PnL by quantity", () => {
      const pnl = calculatePnL("short", 100000, 95000, 2);
      expect(pnl).toBe(10000); // Double profit for double quantity
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small price movements", () => {
      const pnl = calculatePnL("long", 100000, 100000.01, 1);
      expect(pnl).toBeCloseTo(0.01, 10);
    });

    it("should handle large quantities", () => {
      const pnl = calculatePnL("long", 100000, 101000, 100);
      expect(pnl).toBe(100000); // $1,000 × 100 = $100,000
    });

    it("should handle fractional quantities", () => {
      const pnl = calculatePnL("long", 100000, 110000, 0.001);
      expect(pnl).toBe(10); // $10,000 × 0.001 = $10
    });
  });
});

describe("Margin Calculation", () => {
  it("should calculate margin without leverage (1x)", () => {
    const margin = calculateRequiredMargin(100000, 1, 1);
    expect(margin).toBe(100000);
  });

  it("should calculate margin with 10x leverage", () => {
    const margin = calculateRequiredMargin(100000, 1, 10);
    expect(margin).toBe(10000);
  });

  it("should calculate margin with 100x leverage", () => {
    const margin = calculateRequiredMargin(100000, 1, 100);
    expect(margin).toBe(1000);
  });

  it("should scale by quantity", () => {
    const margin = calculateRequiredMargin(100000, 0.5, 10);
    expect(margin).toBe(5000);
  });

  it("should handle fractional leverage", () => {
    const margin = calculateRequiredMargin(100000, 1, 2.5);
    expect(margin).toBe(40000);
  });
});

describe("Take Profit Logic", () => {
  describe("Long Orders", () => {
    it("should trigger TP when price reaches target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "long",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        takeProfit: 110000,
      };

      const result = checkLiquidation(order, 110000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("TakeProfit");
      expect(result.pnl).toBe(10000);
    });

    it("should trigger TP when price exceeds target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "long",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        takeProfit: 110000,
      };

      const result = checkLiquidation(order, 115000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("TakeProfit");
    });

    it("should not trigger TP when price below target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "long",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        takeProfit: 110000,
      };

      const result = checkLiquidation(order, 105000);
      expect(result.shouldClose).toBe(false);
    });
  });

  describe("Short Orders", () => {
    it("should trigger TP when price reaches target (below opening)", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "short",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        takeProfit: 90000,
      };

      const result = checkLiquidation(order, 90000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("TakeProfit");
      expect(result.pnl).toBe(10000);
    });

    it("should trigger TP when price goes below target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "short",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        takeProfit: 90000,
      };

      const result = checkLiquidation(order, 85000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("TakeProfit");
    });

    it("should not trigger TP when price above target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "short",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        takeProfit: 90000,
      };

      const result = checkLiquidation(order, 95000);
      expect(result.shouldClose).toBe(false);
    });
  });
});

describe("Stop Loss Logic", () => {
  describe("Long Orders", () => {
    it("should trigger SL when price reaches target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "long",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        stopLoss: 95000,
      };

      const result = checkLiquidation(order, 95000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("StopLoss");
      expect(result.pnl).toBe(-5000);
    });

    it("should trigger SL when price goes below target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "long",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        stopLoss: 95000,
      };

      const result = checkLiquidation(order, 90000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("StopLoss");
    });

    it("should not trigger SL when price above target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "long",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        stopLoss: 95000,
      };

      const result = checkLiquidation(order, 97000);
      expect(result.shouldClose).toBe(false);
    });
  });

  describe("Short Orders", () => {
    it("should trigger SL when price reaches target (above opening)", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "short",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        stopLoss: 105000,
      };

      const result = checkLiquidation(order, 105000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("StopLoss");
      expect(result.pnl).toBe(-5000);
    });

    it("should trigger SL when price goes above target", () => {
      const order: Order = {
        id: "test-1",
        userId: "user-1",
        asset: "BTC",
        side: "short",
        qty: 1,
        leverage: 10,
        openingPrice: 100000,
        stopLoss: 105000,
      };

      const result = checkLiquidation(order, 110000);
      expect(result.shouldClose).toBe(true);
      expect(result.reason).toBe("StopLoss");
    });
  });
});

describe("Margin Liquidation", () => {
  it("should liquidate when remaining margin falls below 5% threshold", () => {
    // 10x leverage on $100,000 = $10,000 margin
    // Liquidation threshold = $10,000 * 0.05 = $500
    // Need PnL of -$9,500 to hit threshold
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
    };

    // Price drop of $9,600 = -$9,600 PnL
    // Remaining margin = $10,000 - $9,600 = $400 < $500 threshold
    const result = checkLiquidation(order, 90400);
    expect(result.shouldClose).toBe(true);
    expect(result.reason).toBe("margin");
  });

  it("should not liquidate when margin is above threshold", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
    };

    // Price drop of $5,000 = -$5,000 PnL
    // Remaining margin = $10,000 - $5,000 = $5,000 > $500 threshold
    const result = checkLiquidation(order, 95000);
    expect(result.shouldClose).toBe(false);
  });

  it("should trigger liquidation faster with higher leverage", () => {
    // 100x leverage on $100,000 = $1,000 margin
    // Liquidation threshold = $1,000 * 0.05 = $50
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 100,
      openingPrice: 100000,
    };

    // Just a 1% price drop = -$1,000 PnL
    // Remaining margin = $1,000 - $1,000 = $0 < $50 threshold
    const result = checkLiquidation(order, 99000);
    expect(result.shouldClose).toBe(true);
    expect(result.reason).toBe("margin");
  });

  it("should liquidate short positions when price increases", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "short",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
    };

    // Price increase of $9,600 = -$9,600 PnL for short
    const result = checkLiquidation(order, 109600);
    expect(result.shouldClose).toBe(true);
    expect(result.reason).toBe("margin");
  });

  it("should not trigger margin liquidation for 1x leverage", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 1,
      openingPrice: 100000,
    };

    // Even 50% price drop has enough margin
    const result = checkLiquidation(order, 50000);
    expect(result.shouldClose).toBe(false);
  });
});

describe("TP/SL Priority", () => {
  it("should trigger TP before checking margin", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
      takeProfit: 110000,
      stopLoss: 90000,
    };

    const result = checkLiquidation(order, 110000);
    expect(result.reason).toBe("TakeProfit");
  });

  it("should trigger SL before checking margin", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
      takeProfit: 110000,
      stopLoss: 95000, // SL at 95k
    };

    const result = checkLiquidation(order, 95000);
    expect(result.reason).toBe("StopLoss");
  });
});

describe("Order Closing Balance Restoration", () => {
  it("should calculate correct return amount for TP close", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
      takeProfit: 110000,
    };

    const result = checkLiquidation(order, 110000);
    const margin = calculateRequiredMargin(100000, 1, 10); // $10,000
    const returnAmount = margin + result.pnl; // $10,000 + $10,000 = $20,000

    expect(returnAmount).toBe(20000);
  });

  it("should calculate correct return amount for SL close", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
      stopLoss: 95000,
    };

    const result = checkLiquidation(order, 95000);
    const margin = calculateRequiredMargin(100000, 1, 10); // $10,000
    const returnAmount = margin + result.pnl; // $10,000 - $5,000 = $5,000

    expect(returnAmount).toBe(5000);
  });

  it("should return minimal amount on liquidation", () => {
    const order: Order = {
      id: "test-1",
      userId: "user-1",
      asset: "BTC",
      side: "long",
      qty: 1,
      leverage: 10,
      openingPrice: 100000,
    };

    const result = checkLiquidation(order, 90000);
    const margin = calculateRequiredMargin(100000, 1, 10); // $10,000
    const remainingMargin = Math.max(0, margin + result.pnl); // $10,000 - $10,000 = $0

    expect(remainingMargin).toBe(0);
  });
});

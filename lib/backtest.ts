import type { DailyCandle } from "./db";
import { getTargetPercent } from "./strategy";

export interface BacktestTrade {
    symbol: string;
    buyDate: string;
    buyPrice: number;
    sellDate: string;
    sellPrice: number;
    buyNumber: number;
    targetPercent: number;
    profit: number;
    profitPercent: number;
    holdingDays: number;
}

export interface OpenPosition {
    buyDate: string;
    buyPrice: number;
    quantity: number;
    buyNumber: number;
    targetPercent: number;
    currentPrice: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
}

export interface BacktestResult {
    symbol: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalCapital: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number; // Realized + Unrealized
    totalProfitPercent: number;
    realizedProfit: number;
    unrealizedProfit: number;
    blockedCapital: number; // Cost basis of open positions
    maxDrawdown: number;
    trades: BacktestTrade[];
    openPositions: OpenPosition[];
    equityCurve: { date: string; equity: number }[];
}

/**
 * Run backtest on historical data for a single stock.
 * @param symbol - Stock symbol
 * @param candles - Daily candles sorted by date ASCENDING
 * @param initialCapital - Starting capital
 * @param perTradeAmount - Amount to invest per trade (default: initialCapital / 50)
 */
export function runBacktest(
    symbol: string,
    candles: DailyCandle[],
    initialCapital: number = 500000,
    perTradeAmount?: number
): BacktestResult | null {
    if (candles.length < 21) {
        return null;
    }

    const tradeAmount = perTradeAmount ?? initialCapital / 50;
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: string; equity: number }[] = [];

    let cash = initialCapital;
    let isTracking = false;
    let currentBuyNumber = 0;
    let internalOpenPositions: {
        buyDate: string;
        buyPrice: number;
        quantity: number;
        buyNumber: number;
        targetPercent: number;
    }[] = [];

    let maxEquity = initialCapital;
    let maxDrawdown = 0;

    for (let i = 20; i < candles.length; i++) {
        const day = candles[i];
        const prev20 = candles.slice(i - 20, i);
        const twentyDayHigh = Math.max(...prev20.map((c) => c.high));
        const twentyDayLow = Math.min(...prev20.map((c) => c.low));

        // Calculate current equity (cash + value of open positions)
        let positionValue = 0;
        for (const pos of internalOpenPositions) {
            positionValue += pos.quantity * day.close;
        }
        const currentEquity = cash + positionValue;
        equityCurve.push({ date: day.date, equity: currentEquity });

        // Track max drawdown
        if (currentEquity > maxEquity) {
            maxEquity = currentEquity;
        }
        const drawdown = ((maxEquity - currentEquity) / maxEquity) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }

        // Check for sell signals (target reached)
        const positionsToClose: number[] = [];
        for (let j = 0; j < internalOpenPositions.length; j++) {
            const pos = internalOpenPositions[j];
            const targetPrice = pos.buyPrice * (1 + pos.targetPercent / 100);
            if (day.high >= targetPrice) {
                // Target reached, sell at target price
                const sellPrice = targetPrice;
                const profit = (sellPrice - pos.buyPrice) * pos.quantity;
                const profitPercent = ((sellPrice - pos.buyPrice) / pos.buyPrice) * 100;
                const buyDateObj = new Date(pos.buyDate);
                const sellDateObj = new Date(day.date);
                const holdingDays = Math.ceil((sellDateObj.getTime() - buyDateObj.getTime()) / (1000 * 60 * 60 * 24));

                trades.push({
                    symbol,
                    buyDate: pos.buyDate,
                    buyPrice: pos.buyPrice,
                    sellDate: day.date,
                    sellPrice,
                    buyNumber: pos.buyNumber,
                    targetPercent: pos.targetPercent,
                    profit,
                    profitPercent,
                    holdingDays,
                });

                cash += pos.quantity * sellPrice;
                positionsToClose.push(j);
            }
        }

        // Remove closed positions
        internalOpenPositions = internalOpenPositions.filter((_, idx) => !positionsToClose.includes(idx));

        // If all positions closed and we were in a buying sequence, reset buy number and tracking
        if (internalOpenPositions.length === 0 && currentBuyNumber > 0) {
            currentBuyNumber = 0;
            isTracking = false;
        }

        // Check for tracking (20d low touched)
        if (day.low <= twentyDayLow) {
            isTracking = true;
        }

        // Check for buy signal (20d high crossed while tracking)
        if (isTracking && day.high > twentyDayHigh) {
            currentBuyNumber++;
            const targetPercent = getTargetPercent(currentBuyNumber);
            const buyPrice = twentyDayHigh; // Assume we buy at the breakout price
            const quantity = Math.floor(tradeAmount / buyPrice);

            if (quantity > 0 && cash >= quantity * buyPrice) {
                cash -= quantity * buyPrice;
                internalOpenPositions.push({
                    buyDate: day.date,
                    buyPrice,
                    quantity,
                    buyNumber: currentBuyNumber,
                    targetPercent,
                });
            }

            // Reset tracking after buy
            isTracking = false;
        }
    }

    // --- Final Calculation ---
    const lastPrice = candles[candles.length - 1].close;

    // Realized Profit (from closed trades)
    const realizedProfit = trades.reduce((sum, t) => sum + t.profit, 0);

    // Unrealized Positions
    const openPositions: OpenPosition[] = internalOpenPositions.map(pos => {
        const currentValue = pos.quantity * lastPrice;
        const costBasis = pos.quantity * pos.buyPrice;
        const pnl = currentValue - costBasis;
        const pnlPercent = (pnl / costBasis) * 100;

        return {
            buyDate: pos.buyDate,
            buyPrice: pos.buyPrice,
            quantity: pos.quantity,
            buyNumber: pos.buyNumber,
            targetPercent: pos.targetPercent,
            currentPrice: lastPrice,
            currentValue,
            pnl,
            pnlPercent
        };
    });

    const unrealizedProfit = openPositions.reduce((sum, p) => sum + p.pnl, 0);
    const blockedCapital = openPositions.reduce((sum, p) => sum + (p.quantity * p.buyPrice), 0);
    const closingPositionValue = openPositions.reduce((sum, p) => sum + p.currentValue, 0);

    // Final Capital = Cash + Value of Open Positions
    // Total Profit = Realized + Unrealized
    const finalCapital = cash + closingPositionValue;
    const totalProfit = finalCapital - initialCapital;
    const totalProfitPercent = (totalProfit / initialCapital) * 100;

    const winningTrades = trades.filter((t) => t.profit > 0).length;
    const losingTrades = trades.filter((t) => t.profit <= 0).length;

    return {
        symbol,
        startDate: candles[20].date,
        endDate: candles[candles.length - 1].date,
        initialCapital,
        finalCapital,
        totalTrades: trades.length,
        winningTrades,
        losingTrades,
        winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
        totalProfit,
        totalProfitPercent,
        realizedProfit,
        unrealizedProfit,
        blockedCapital,
        maxDrawdown,
        trades,
        openPositions,
        equityCurve,
    };
}

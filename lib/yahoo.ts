import YahooFinance from "yahoo-finance2";
import { format, subYears } from "date-fns";
import type { DailyCandle } from "./db";

// Initialize Yahoo Finance instance (v3 API)
const yahooFinance = new YahooFinance();

// Core fetch function with explicit dates
export async function fetchCandles(
    symbol: string,
    startDate: Date,
    endDate: Date = new Date()
): Promise<DailyCandle[]> {
    try {
        const result = await yahooFinance.historical(symbol, {
            period1: format(startDate, "yyyy-MM-dd"),
            period2: format(endDate, "yyyy-MM-dd"),
            interval: "1d",
        });

        const candles = result.map((row) => ({
            symbol,
            date: format(row.date, "yyyy-MM-dd"),
            open: row.open ?? 0,
            high: row.high ?? 0,
            low: row.low ?? 0,
            close: row.close ?? 0,
            volume: row.volume ?? 0,
        }));

        return candles.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
        return [];
    }
}

// Legacy wrapper (consumes the new function)
export async function fetchHistoricalData(
    symbol: string,
    yearsBack: number = 3
): Promise<DailyCandle[]> {
    const endDate = new Date();
    const startDate = subYears(endDate, yearsBack);
    return fetchCandles(symbol, startDate, endDate);
}

// Hardcoded Nifty 100 symbols (Yahoo Finance format: .NS suffix)
// This list should be updated periodically
export const NIFTY_100_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "HCLTECH.NS",
    "SUNPHARMA.NS", "TITAN.NS", "ULTRACEMCO.NS", "BAJFINANCE.NS", "WIPRO.NS",
    "NESTLEIND.NS", "M&M.NS", "NTPC.NS", "POWERGRID.NS", "TATAMOTORS.NS",
    "JSWSTEEL.NS", "ONGC.NS", "TATASTEEL.NS", "ADANIENT.NS", "ADANIPORTS.NS",
    "COALINDIA.NS", "BPCL.NS", "GRASIM.NS", "DIVISLAB.NS", "DRREDDY.NS",
    "BRITANNIA.NS", "CIPLA.NS", "APOLLOHOSP.NS", "EICHERMOT.NS", "HEROMOTOCO.NS",
    "BAJAJFINSV.NS", "TATACONSUM.NS", "SBILIFE.NS", "HDFCLIFE.NS", "TECHM.NS",
    "INDUSINDBK.NS", "HINDALCO.NS", "VEDL.NS", "GAIL.NS", "IOC.NS",
    "UPL.NS", "DLF.NS", "ADANIGREEN.NS", "ADANITRANS.NS", "BANKBARODA.NS",
    "PNB.NS", "CANBK.NS", "FEDERALBNK.NS", "IDFCFIRSTB.NS", "YESBANK.NS",
    "SHREECEM.NS", "AMBUJACEM.NS", "ACC.NS", "PIDILITIND.NS", "GODREJCP.NS",
    "DABUR.NS", "MARICO.NS", "COLPAL.NS", "PGHH.NS", "HAVELLS.NS",
    "VOLTAS.NS", "WHIRLPOOL.NS", "TRENT.NS", "ZOMATO.NS", "NYKAA.NS",
    "PAYTM.NS", "POLICYBZR.NS", "DMART.NS", "TATAPOWER.NS", "NHPC.NS",
    "PFC.NS", "RECLTD.NS", "IRFC.NS", "CONCOR.NS", "SAIL.NS",
    "NMDC.NS", "JINDALSTEL.NS", "TATAELXSI.NS", "LTIM.NS", "MPHASIS.NS",
    "COFORGE.NS", "PERSISTENT.NS", "HAPPSTMNDS.NS", "NAUKRI.NS", "INDIGO.NS",
    "PIIND.NS", "SRF.NS", "ATUL.NS", "CHOLAFIN.NS", "BAJAJHLDNG.NS",
];

// Get stock name from Yahoo Finance
export async function getStockInfo(symbol: string): Promise<{ symbol: string; name: string } | null> {
    try {
        const quote = await yahooFinance.quote(symbol);
        return {
            symbol,
            name: quote.shortName || quote.longName || symbol.replace(".NS", ""),
        };
    } catch {
        return { symbol, name: symbol.replace(".NS", "") };
    }
}

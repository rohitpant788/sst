"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { NIFTY_100_SYMBOLS } from "@/lib/nifty100";
import { NIFTY_500_SYMBOLS } from "@/lib/nifty500";

interface BacktestTrade {
    symbol: string;
    buyDate: string;
    buyPrice: number;
    sellDate: string;
    sellPrice: number;
    profit: number;
    profitPercent: number;
    holdingDays: number;
}

interface TradeActivity {
    symbol: string;
    type: "BUY" | "SELL";
    price: number;
    quantity: number;
    amount: number;
    buyNumber: number;
    profit?: number;
    date: string;
    purchaseDate?: string;
}

interface OpenPosition {
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

interface BacktestResult {
    symbol: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalCapital: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number;
    totalProfitPercent: number;
    cagr: number;
    realizedProfit: number;
    unrealizedProfit: number;
    blockedCapital: number;
    maxDrawdown: number;
    trades: BacktestTrade[];
    openPositions: OpenPosition[];
    equityCurve: { date: string; equity: number }[];
}

interface AggregateResult {
    totalTrades: number;
    totalProfit: number;
    realizedProfit: number;
    unrealizedProfit: number;
    blockedCapital: number;
    winningTrades: number;
    losingTrades: number;
    finalCapital: number;
    winRate: number;
    totalProfitPercent: number;
    cagr: number;
    maxDrawdown: number;
    benchmark?: {
        symbol: string;
        totalReturnPercent: number;
        startPrice: number;
        endPrice: number;
        finalCapital: number;
    };
}

interface PortfolioDailyLog {
    date: string;
    cash: number;
    invested: number;
    portfolioValue: number;
    dayProfit: number;
    totalProfit: number;
    activities: TradeActivity[];
}

interface ApiResponse {
    results: BacktestResult[];
    aggregate: AggregateResult;
    portfolioDiary?: PortfolioDailyLog[];
}

type UniverseType = "NIFTY_100" | "NIFTY_500" | "CUSTOM";

export default function BacktestPage() {
    // Config State
    const [mode, setMode] = useState<"single" | "multi">("single");
    const [symbol, setSymbol] = useState("RELIANCE.NS");

    // Multi-Mode State
    const [universe, setUniverse] = useState<UniverseType>("NIFTY_100");
    const [customListText, setCustomListText] = useState("");
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

    const [yearsBack, setYearsBack] = useState(3);
    const [dateMode, setDateMode] = useState<"relative" | "absolute">("relative");
    const [startDate, setStartDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [capital, setCapital] = useState(500000);

    // Sizing Calculator State
    const [sizingMode, setSizingMode] = useState<"manual" | "auto">("auto");
    const [tradeSize, setTradeSize] = useState(10); // Manual Input

    // Defaults: 16 stocks, 3 levels
    const [maxStocks, setMaxStocks] = useState(16);
    const [avgLevels, setAvgLevels] = useState(3);
    const [targetProfitPercent, setTargetProfitPercent] = useState(6);
    const [exitStrategy, setExitStrategy] = useState<"WEIGHTED_AVERAGE" | "LIFO">("WEIGHTED_AVERAGE");

    // Results State
    const [loading, setLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
        key: "date",
        direction: "asc",
    });

    // Derived Trade Size
    const calculatedTradeSize = useMemo(() => {
        if (sizingMode === "manual") return tradeSize;
        const totalSlots = maxStocks * avgLevels;
        return totalSlots > 0 ? parseFloat((100 / totalSlots).toFixed(2)) : 0;
    }, [sizingMode, tradeSize, maxStocks, avgLevels]);

    // Current Universe List logic
    const currentUniverseList = useMemo(() => {
        if (universe === "NIFTY_100") return NIFTY_100_SYMBOLS;
        if (universe === "NIFTY_500") return NIFTY_500_SYMBOLS;
        // Parse custom list
        if (universe === "CUSTOM") {
            return customListText
                .split(/[\n,]+/) // Split by newline or comma
                .map(s => s.trim().toUpperCase())
                .filter(s => s.length > 0);
        }
        return [];
    }, [universe, customListText]);

    const handleSelectAll = () => {
        if (selectedSymbols.length === currentUniverseList.length) {
            setSelectedSymbols([]);
        } else {
            setSelectedSymbols([...currentUniverseList]);
        }
    };

    const toggleSymbol = (sym: string) => {
        if (selectedSymbols.includes(sym)) {
            setSelectedSymbols(selectedSymbols.filter(s => s !== sym));
        } else {
            setSelectedSymbols([...selectedSymbols, sym]);
        }
    };

    const toggleRow = (sym: string) => {
        if (expandedSymbol === sym) {
            setExpandedSymbol(null);
        } else {
            setExpandedSymbol(sym);
        }
    };

    const runBacktest = async () => {
        setLoading(true);
        setError(null);
        setApiResponse(null);
        setExpandedSymbol(null);

        try {
            const finalSymbols = mode === "single" ? [symbol] : selectedSymbols;

            if (finalSymbols.length === 0) {
                throw new Error("Please select at least one symbol.");
            }

            const payload = {
                yearsBack: dateMode === "relative" ? yearsBack : undefined,
                startDate: dateMode === "absolute" ? startDate : undefined,
                endDate: dateMode === "absolute" ? endDate : undefined,
                initialCapital: capital,
                tradeSizePercent: calculatedTradeSize,
                symbols: finalSymbols,
                exitStrategy,
                targetProfitPercent,
                avgLevels
            };

            const res = await fetch("/api/backtest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Backtest failed");
            }

            const data = await res.json();
            setApiResponse(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    // Sorting Logic
    const sortedDiary = useMemo(() => {
        if (!apiResponse?.portfolioDiary) return [];
        const sorted = [...apiResponse.portfolioDiary];
        sorted.sort((a, b) => {
            // value extraction
            let aValue = (a as any)[sortConfig.key];
            let bValue = (b as any)[sortConfig.key];

            // Special handling for nested or specific columns if needed
            // currently all keys (date, portfolioValue, cash, invested, dayProfit, totalProfit) are top level

            if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [apiResponse, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
        }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <Link href="/" className="text-cyan-400 hover:underline text-sm mb-2 inline-block">
                            ← Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold">Backtest SST Strategy</h1>
                        <p className="text-gray-400">Batch Backtest & Portfolio Simulation</p>
                    </div>
                </div>

                {/* Config Form */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Left Column: Selection & Basics */}
                    <div className="lg:col-span-2 bg-white/5 rounded-xl border border-white/10 p-6">
                        <h3 className="text-lg font-semibold mb-4 text-cyan-400">1. Symbol Selection</h3>

                        <div className="flex gap-4 mb-4">
                            <button
                                onClick={() => setMode("single")}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "single" ? "bg-cyan-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"
                                    }`}
                            >
                                Single Stock
                            </button>
                            <button
                                onClick={() => setMode("multi")}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "multi" ? "bg-purple-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"
                                    }`}
                            >
                                Multi / Batch
                            </button>
                        </div>

                        {mode === "single" ? (
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Symbol</label>
                                <input
                                    type="text"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                                    placeholder="e.g., RELIANCE.NS"
                                />
                            </div>
                        ) : (
                            <div>
                                {/* Universe Selector */}
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                    <button
                                        onClick={() => setUniverse("NIFTY_100")}
                                        className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${universe === "NIFTY_100" ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" : "border-white/20 text-gray-400 hover:bg-white/5"
                                            }`}
                                    >
                                        Nifty 100
                                    </button>
                                    <button
                                        onClick={() => setUniverse("NIFTY_500")}
                                        className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${universe === "NIFTY_500" ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" : "border-white/20 text-gray-400 hover:bg-white/5"
                                            }`}
                                    >
                                        Nifty 500
                                    </button>
                                    <button
                                        onClick={() => setUniverse("CUSTOM")}
                                        className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${universe === "CUSTOM" ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" : "border-white/20 text-gray-400 hover:bg-white/5"
                                            }`}
                                    >
                                        Custom List
                                    </button>
                                </div>

                                {universe === "CUSTOM" ? (
                                    <div className="mb-4">
                                        <label className="block text-sm text-gray-400 mb-2">Enter Symbols (comma or newline separated)</label>
                                        <textarea
                                            value={customListText}
                                            onChange={(e) => setCustomListText(e.target.value)}
                                            placeholder="RELIANCE.NS, TCS.NS, INFBEAM.NS..."
                                            className="w-full h-32 px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400 font-mono text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Found {currentUniverseList.length} symbols</p>
                                    </div>
                                ) : null}

                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-sm text-gray-400">
                                        Select Symbols ({selectedSymbols.length})
                                    </label>
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                                    >
                                        {selectedSymbols.length === currentUniverseList.length && currentUniverseList.length > 0 ? "Deselect All" : "Select All"}
                                    </button>
                                </div>
                                <div className="h-48 overflow-y-auto bg-black/20 rounded-lg border border-white/10 p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {currentUniverseList.map(sym => (
                                        <label key={sym} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-white/5 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedSymbols.includes(sym)}
                                                onChange={() => toggleSymbol(sym)}
                                                className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
                                            />
                                            <span className="truncate">{sym}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm text-gray-400">Duration</label>
                                    <div className="flex bg-black/40 rounded p-0.5 border border-white/10">
                                        <button
                                            onClick={() => setDateMode("relative")}
                                            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${dateMode === "relative" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"}`}
                                        >
                                            Years
                                        </button>
                                        <button
                                            onClick={() => setDateMode("absolute")}
                                            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${dateMode === "absolute" ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"}`}
                                        >
                                            Dates
                                        </button>
                                    </div>
                                </div>
                                {dateMode === "relative" ? (
                                    <select
                                        value={yearsBack}
                                        onChange={(e) => setYearsBack(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                                    >
                                        <option value={1}>1 Year</option>
                                        <option value={2}>2 Years</option>
                                        <option value={3}>3 Years</option>
                                        <option value={5}>5 Years</option>
                                        <option value={10}>10 Years</option>
                                    </select>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-1/2 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs focus:outline-none focus:border-cyan-400 text-white"
                                        />
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-1/2 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs focus:outline-none focus:border-cyan-400 text-white"
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Portfolio Capital (₹)</label>
                                <input
                                    type="number"
                                    value={capital}
                                    onChange={(e) => setCapital(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Sizing Calculator */}
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                        <h3 className="text-lg font-semibold mb-4 text-purple-400">2. Sizing Calculator</h3>

                        <div className="flex gap-2 mb-4 p-1 bg-black/20 rounded-lg">
                            <button
                                onClick={() => setSizingMode("auto")}
                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${sizingMode === "auto" ? "bg-white/20 text-white" : "text-gray-400"
                                    }`}
                            >
                                Auto Calculate
                            </button>
                            <button
                                onClick={() => setSizingMode("manual")}
                                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${sizingMode === "manual" ? "bg-white/20 text-white" : "text-gray-400"
                                    }`}
                            >
                                Manual %
                            </button>
                        </div>

                        {sizingMode === "auto" ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Max Concurrent Stocks</label>
                                    <input
                                        type="number"
                                        value={maxStocks}
                                        onChange={(e) => setMaxStocks(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Averaging Levels (Slots/Stock)</label>
                                    <input
                                        type="number"
                                        value={avgLevels}
                                        onChange={(e) => setAvgLevels(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
                                    <p className="text-xs text-purple-300 mb-1">Calculated Trade Size</p>
                                    <p className="text-2xl font-bold text-white">{calculatedTradeSize}%</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Amount: ₹{((capital * calculatedTradeSize) / 100).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Trade Size (%)</label>
                                <input
                                    type="number"
                                    value={tradeSize}
                                    onChange={(e) => setTradeSize(Number(e.target.value))}
                                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg"
                                />
                            </div>
                        )}

                        <div className="mt-4">
                            <label className="block text-sm text-gray-400 mb-2">Target Profit (%)</label>
                            <input
                                type="number"
                                value={targetProfitPercent}
                                onChange={(e) => setTargetProfitPercent(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                                placeholder="e.g. 6"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Target profit per trade/position.</p>
                        </div>

                        <div className="mt-6 border-t border-white/10 pt-4">
                            <label className="block text-sm text-gray-400 mb-2">Exit Strategy</label>
                            <div className="flex gap-2 p-1 bg-black/20 rounded-lg">
                                <button
                                    onClick={() => setExitStrategy("WEIGHTED_AVERAGE")}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${exitStrategy === "WEIGHTED_AVERAGE" ? "bg-cyan-600 text-white" : "text-gray-400"
                                        }`}
                                >
                                    Weighted Avg (Default)
                                </button>
                                <button
                                    onClick={() => setExitStrategy("LIFO")}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${exitStrategy === "LIFO" ? "bg-purple-600 text-white" : "text-gray-400"
                                        }`}
                                >
                                    Individual (LIFO)
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2">
                                {exitStrategy === "WEIGHTED_AVERAGE"
                                    ? "Sells ALL positions when the average price hits target."
                                    : "Sells individual positions as each hits its own target."}
                            </p>
                        </div>

                        <div className="mt-8 flex flex-col gap-3">
                            {apiResponse && (
                                <button
                                    onClick={() => window.print()}
                                    className="print-hidden w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path></svg>
                                    Export Results to PDF
                                </button>
                            )}

                            <button
                                onClick={runBacktest}
                                disabled={loading}
                                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Running...
                                    </span>
                                ) : "Run Analysis"}
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-8 text-red-400">
                        {error}
                    </div>
                )}

                {apiResponse && (
                    <>
                        {/* Comparison vs Benchmark */}
                        {apiResponse.aggregate.benchmark && (
                            <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 mb-8 border border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-4">🆚 Strategy vs Benchmark (Nifty 50)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Strategy Stats */}
                                    <div className="text-center">
                                        <p className="text-gray-400 text-sm mb-1">SST Strategy Return</p>
                                        <p className={`text-3xl font-bold ${apiResponse.aggregate.totalProfitPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                                            {apiResponse.aggregate.totalProfitPercent.toFixed(2)}%
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Final: ₹{apiResponse.aggregate.finalCapital.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Comparison Visual */}
                                    <div className="flex flex-col items-center justify-center">
                                        <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">Alpha (Outperformance)</p>
                                        <div className={`px-4 py-2 rounded-lg font-bold text-xl ${(apiResponse.aggregate.totalProfitPercent - apiResponse.aggregate.benchmark.totalReturnPercent) >= 0
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {(apiResponse.aggregate.totalProfitPercent - apiResponse.aggregate.benchmark.totalReturnPercent) >= 0 ? "+" : ""}
                                            {(apiResponse.aggregate.totalProfitPercent - apiResponse.aggregate.benchmark.totalReturnPercent).toFixed(2)}%
                                        </div>
                                    </div>

                                    {/* Benchmark Stats */}
                                    <div className="text-center">
                                        <p className="text-gray-400 text-sm mb-1">Nifty 50 Index Fund</p>
                                        <p className="text-3xl font-bold text-blue-400">
                                            {apiResponse.aggregate.benchmark.totalReturnPercent.toFixed(2)}%
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Final: ₹{apiResponse.aggregate.benchmark.finalCapital.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Aggregate Summary */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {/* Total Return */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Total Return</div>
                                <div className={`text-2xl font-bold ${apiResponse.aggregate.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {apiResponse.aggregate.totalProfit >= 0 ? "+" : ""}
                                    {(apiResponse.aggregate.totalProfitPercent ?? 0).toFixed(1)}%
                                </div>
                                <div className="text-sm text-gray-500">
                                    ₹{apiResponse.aggregate.totalProfit.toLocaleString()}
                                </div>
                            </div>

                            {/* CAGR */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">CAGR</div>
                                <div className={`text-2xl font-bold ${apiResponse.aggregate.cagr >= 0 ? "text-purple-400" : "text-gray-400"}`}>
                                    {(apiResponse.aggregate.cagr ?? 0).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Annualized Growth
                                </div>
                            </div>

                            {/* Win Rate */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Win Rate</div>
                                <div className="text-2xl font-bold text-blue-400">
                                    {(apiResponse.aggregate.winRate ?? 0).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {apiResponse.aggregate.totalTrades} Trades
                                </div>
                            </div>

                            {/* Max Drawdown */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Max Drawdown</div>
                                <div className="text-2xl font-bold text-yellow-400">
                                    -{Math.abs(apiResponse.aggregate.maxDrawdown ?? 0).toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        {/* Tabs: Details vs Diary */}
                        <div className="mb-8">
                            <div className="flex border-b border-white/10">
                                <button className="px-6 py-3 border-b-2 border-cyan-400 text-cyan-400 font-medium">
                                    Stock-wise Details
                                </button>
                                {/* Note: Ideally use state for tabs, but simplifying for now or putting this below */}
                            </div>
                        </div>

                        {/* Detailed Table */}
                        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden mb-8">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Details by Symbol</h3>
                                <span className="text-sm text-gray-400">{apiResponse.results.length} Stocks Tested</span>
                            </div>
                            <div className="max-h-[600px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-white/5 sticky top-0 z-10">
                                        <tr>
                                            <th className="w-10 p-3"></th>
                                            <th className="text-left p-3 text-gray-400">Symbol</th>
                                            <th className="text-right p-3 text-gray-400">Trades (Closed)</th>
                                            <th className="text-right p-3 text-gray-400">Open Pos</th>
                                            <th className="text-right p-3 text-gray-400">Realized P&L</th>
                                            <th className="text-right p-3 text-gray-400">Unrealized P&L</th>
                                            <th className="text-right p-3 text-gray-400">Total Return %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {apiResponse.results.map((res, idx) => (
                                            <>
                                                <tr
                                                    key={res.symbol}
                                                    onClick={() => toggleRow(res.symbol)}
                                                    className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-3 text-center text-gray-500">
                                                        {expandedSymbol === res.symbol ? "▼" : "▶"}
                                                    </td>
                                                    <td className="p-3 font-medium text-cyan-400">{res.symbol}</td>
                                                    <td className="p-3 text-right">{res.totalTrades}</td>
                                                    <td className="p-3 text-right text-orange-300">{res.openPositions.length}</td>
                                                    <td className={`p-3 text-right ${res.realizedProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                        ₹{res.realizedProfit.toLocaleString()}
                                                    </td>
                                                    <td className={`p-3 text-right ${res.unrealizedProfit >= 0 ? "text-blue-300" : "text-yellow-300"}`}>
                                                        ₹{res.unrealizedProfit.toLocaleString()}
                                                    </td>
                                                    <td className={`p-3 text-right ${res.totalProfitPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                        {res.totalProfitPercent.toFixed(2)}%
                                                    </td>
                                                </tr>
                                                {/* Expanded Details Row */}
                                                {expandedSymbol === res.symbol && (
                                                    <tr key={`${res.symbol}-details`} className="bg-black/20">
                                                        <td colSpan={7} className="p-4">
                                                            <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                                                                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Trade Audit ({res.symbol})</h4>

                                                                {res.trades.length === 0 && res.openPositions.length === 0 ? (
                                                                    <p className="text-gray-500 italic text-xs">No trades triggered.</p>
                                                                ) : (
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-gray-500 border-b border-white/5">
                                                                                <th className="text-left py-2">Trigger Date</th>
                                                                                <th className="text-right py-2">Buy Price</th>
                                                                                <th className="text-left py-2 pl-4">Close Date</th>
                                                                                <th className="text-right py-2">Sell / Cur Price</th>
                                                                                <th className="text-right py-2">P/L</th>
                                                                                <th className="text-right py-2">Status</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {/* Open Positions First */}
                                                                            {res.openPositions.map((pos, pIdx) => (
                                                                                <tr key={`open-${pIdx}`} className="border-b border-white/5 bg-blue-500/10 hover:bg-blue-500/20">
                                                                                    <td className="py-2 text-blue-300">{pos.buyDate}</td>
                                                                                    <td className="py-2 text-right">₹{pos.buyPrice.toFixed(2)}</td>
                                                                                    <td className="py-2 pl-4 text-gray-500">-</td>
                                                                                    <td className="py-2 text-right font-medium text-white">₹{pos.currentPrice.toFixed(2)}</td>
                                                                                    <td className={`py-2 text-right font-medium ${pos.pnl >= 0 ? "text-blue-300" : "text-yellow-300"}`}>
                                                                                        ₹{pos.pnl.toFixed(0)} ({pos.pnlPercent.toFixed(1)}%)
                                                                                    </td>
                                                                                    <td className="py-2 text-right text-blue-400 font-bold uppercase text-[10px]">
                                                                                        OPEN (Val: ₹{pos.currentValue.toLocaleString()})
                                                                                    </td>
                                                                                </tr>
                                                                            ))}

                                                                            {/* Closed Trades */}
                                                                            {[...res.trades].sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()).map((trade, tIdx) => (
                                                                                <tr key={`closed-${tIdx}`} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                                                                    <td className="py-2">{trade.buyDate}</td>
                                                                                    <td className="py-2 text-right">₹{trade.buyPrice.toFixed(2)}</td>
                                                                                    <td className="py-2 pl-4">{trade.sellDate}</td>
                                                                                    <td className="py-2 text-right">₹{trade.sellPrice.toFixed(2)}</td>
                                                                                    <td className={`py-2 text-right font-medium ${trade.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                                                        ₹{trade.profit.toFixed(0)} ({trade.profitPercent.toFixed(1)}%)
                                                                                    </td>
                                                                                    <td className="py-2 text-right text-gray-400">
                                                                                        Completed
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Trading Journal Table */}
                        {apiResponse.portfolioDiary && (
                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden mb-8">
                                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                                    <h3 className="text-lg font-semibold text-purple-300">📔 Trading Journal (All Trades)</h3>
                                    <span className="text-sm text-gray-400">{apiResponse.portfolioDiary.length} Trading Days</span>
                                </div>
                                <div className="max-h-[600px] overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5 sticky top-0 z-10 text-gray-400 text-xs uppercase tracking-wider">
                                            <tr>
                                                {[
                                                    { key: "date", label: "Date", align: "left" },
                                                    { key: "portfolioValue", label: "Portfolio Value", align: "right" },
                                                    { key: "cash", label: "Cash Balance", align: "right" },
                                                    { key: "invested", label: "Invested", align: "right" },
                                                    { key: "dayProfit", label: "Daily P&L", align: "right" },
                                                    { key: "totalProfit", label: "Total P&L", align: "right" },
                                                ].map((col) => (
                                                    <th
                                                        key={col.key}
                                                        className={`${col.align === "left" ? "text-left" : "text-right"} p-3 cursor-pointer hover:text-white transition-colors select-none`}
                                                        onClick={() => handleSort(col.key)}
                                                    >
                                                        <div className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                                                            {col.label}
                                                            {sortConfig.key === col.key && (
                                                                <span className="text-[10px]">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                                                            )}
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="text-left p-3 pl-6">Trading Journal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedDiary.map((day, idx) => (
                                                <tr key={day.date} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 text-gray-300 font-mono text-xs align-top">{day.date}</td>
                                                    <td className="p-3 text-right font-bold text-white align-top">
                                                        ₹{day.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-400 align-top">
                                                        ₹{day.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="p-3 text-right text-purple-300 align-top">
                                                        ₹{day.invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className={`p-3 text-right font-medium align-top ${day.dayProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                        {day.dayProfit >= 0 ? "+" : ""}₹{day.dayProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className={`p-3 text-right font-medium align-top ${day.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                        ₹{day.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="p-3 pl-6 text-xs text-gray-500 align-top">
                                                        {day.activities && day.activities.length > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {day.activities.map((act, i) => (
                                                                    <div key={i} className={`flex items-center gap-2 p-2 rounded border ${act.type === "BUY"
                                                                        ? "bg-cyan-900/20 border-cyan-500/30 text-cyan-200"
                                                                        : act.profit && act.profit >= 0
                                                                            ? "bg-green-900/20 border-green-500/30 text-green-200"
                                                                            : "bg-red-900/20 border-red-500/30 text-red-200"
                                                                        }`}>
                                                                        <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${act.type === "BUY" ? "bg-cyan-500 text-black" : act.profit && act.profit >= 0 ? "bg-green-500 text-black" : "bg-red-500 text-white"
                                                                            }`}>
                                                                            {act.type}
                                                                        </span>
                                                                        <span className="font-bold">{act.symbol}</span>
                                                                        <span className="text-gray-400">
                                                                            {act.quantity} qty @ ₹{act.price.toFixed(1)}
                                                                        </span>
                                                                        <span className="opacity-75">
                                                                            (₹{act.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                                                        </span>
                                                                        {act.type === "BUY" && act.buyNumber > 1 && (
                                                                            <span className="text-[10px] bg-blue-600/50 px-1 rounded text-white ml-auto">
                                                                                Re-Entry #{act.buyNumber}
                                                                            </span>
                                                                        )}
                                                                        {act.type === "SELL" && act.profit !== undefined && (
                                                                            <span className={`font-bold ml-auto ${act.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                                                {act.profit >= 0 ? "+" : ""}₹{act.profit.toFixed(0)}
                                                                            </span>
                                                                        )}
                                                                        {act.type === "SELL" && act.purchaseDate && (
                                                                            <span className="text-[10px] text-gray-500 ml-2">
                                                                                (Purchased: {act.purchaseDate})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

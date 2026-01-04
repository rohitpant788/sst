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
    benchmark?: {
        symbol: string;
        totalReturnPercent: number;
        startPrice: number;
        endPrice: number;
        finalCapital: number;
    };
}

interface ApiResponse {
    results: BacktestResult[];
    aggregate: AggregateResult;
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

    // Results State
    const [loading, setLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                symbols: finalSymbols
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

                        <div className="mt-8">
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
                            {/* Total Profit */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 col-span-2 lg:col-span-1">
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Total Net Profit</p>
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-2xl font-bold ${apiResponse.aggregate.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        ₹{apiResponse.aggregate.totalProfit.toLocaleString()}
                                    </p>
                                    <span className={`text-sm ${apiResponse.aggregate.totalProfitPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                                        ({apiResponse.aggregate.totalProfitPercent.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>

                            {/* Realized Profit */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Realized Profit (Closed)</p>
                                <p className={`text-xl font-bold ${apiResponse.aggregate.realizedProfit >= 0 ? "text-green-300" : "text-red-300"}`}>
                                    ₹{apiResponse.aggregate.realizedProfit.toLocaleString()}
                                </p>
                            </div>

                            {/* Unrealized Profit */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Unrealized P&L (Open)</p>
                                <p className={`text-xl font-bold ${apiResponse.aggregate.unrealizedProfit >= 0 ? "text-blue-300" : "text-yellow-300"}`}>
                                    ₹{apiResponse.aggregate.unrealizedProfit.toLocaleString()}
                                </p>
                            </div>

                            {/* Blocked Capital */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Blocked Capital</p>
                                <p className="text-xl font-bold text-orange-400">
                                    ₹{apiResponse.aggregate.blockedCapital.toLocaleString()}
                                </p>
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
                    </>
                )}
            </div>
        </div>
    );
}

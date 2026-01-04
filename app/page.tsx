"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(`Synced ${data.results?.length || 0} stocks`);
    } catch (e) {
      setSyncResult("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            SST 2.0
          </h1>
          <p className="text-xl text-gray-300">
            Share Genius Swing Trading Strategy
          </p>
          <p className="text-sm text-gray-500 mt-2">
            20-Day High/Low Breakout Strategy with FIFO Target Management
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
          {/* Scanner Card */}
          <Link href="/scanner" className="group">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-cyan-400/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/20">
              <div className="text-cyan-400 text-4xl mb-4">📊</div>
              <h2 className="text-2xl font-semibold mb-2">Scanner</h2>
              <p className="text-gray-400">
                View stocks in Tracking or Buy Triggered state
              </p>
            </div>
          </Link>

          {/* Backtest Card */}
          <Link href="/backtest" className="group">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-purple-400/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20">
              <div className="text-purple-400 text-4xl mb-4">📈</div>
              <h2 className="text-2xl font-semibold mb-2">Backtest</h2>
              <p className="text-gray-400">
                Test strategy on historical data
              </p>
            </div>
          </Link>

          {/* Portfolio Card */}
          <Link href="/portfolio" className="group">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-pink-400/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-pink-500/20">
              <div className="text-pink-400 text-4xl mb-4">💼</div>
              <h2 className="text-2xl font-semibold mb-2">Portfolio</h2>
              <p className="text-gray-400">
                Track your active positions
              </p>
            </div>
          </Link>
        </div>

        {/* Sync Button */}
        <div className="text-center">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "🔄 Sync Market Data"}
          </button>
          {syncResult && (
            <p className="mt-4 text-green-400">{syncResult}</p>
          )}
        </div>

        {/* Strategy Summary */}
        <div className="mt-16 max-w-2xl mx-auto">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">Strategy Rules</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>✅ <strong>Track</strong> when stock touches 20-Day Low</li>
              <li>✅ <strong>Buy</strong> when it crosses 20-Day High (while tracking)</li>
              <li>✅ <strong>Target:</strong> 10% (1st buy), 8% (2nd), 6% (3rd+)</li>
              <li>✅ <strong>Universe:</strong> Nifty 100 / Nifty 200</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

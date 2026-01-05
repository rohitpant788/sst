# SST - Swing Setup Tracker & Backtesting Engine

A high-performance quantitative analysis dashboard built with **Next.js**, designed to identify, screen, and backtest swing trading strategies on the Nifty 500 universe.

## 🚀 Key Features

- **Automated Screening**: Scans the entire market for specific swing setups.
- **Robust Backtesting Engine**: Replays historical data to validate strategy performance over years.
- **Dynamic Strategy Testing**: Compare different exit strategies (Weighted Average vs. LIFO) and compounding effects.
- **Interactive Visualization**: Rich charts and tables to analyze equity curves, drawdowns, and monthly returns.

---

## 📈 The Strategy (SST)

The core strategy implemented is a **Mean Reversion into Trend Continuation** system. It operates on the principle of identifying stocks that have pulled back significantly (making them "cheap") and waiting for a confirmation of strength before entering.

### 1. The Setup (Tracking Mode)
The system first looks for **value**. A stock enters "Tracking Mode" when:
- **Price touches the 20-Day Low.**
- This indicates the stock is consolidating or in a short-term downtrend, potentially offering a low-risk entry.

### 2. The Trigger (Buy Signal)
Once in tracking mode, the system patiently waits. It does **not** buy blindly at the low.
- **Buy Condition**: Price breaks above the previous **20-Day High**.
- **Logic**: This confirms that the pullback is over and a new momentum leg is likely starting. We buy strength, not weakness.

### 3. Capital Management (Pyramiding)
The system supports scaling in:
- If a stock triggers again while a position is open, it can add to the position (up to 3 levels/pyramids).
- **Position Sizing**: Allocates a fixed percentage of capital or fixed quantity per trade to ensure diversification.

---

## 🧪 Backtesting Logic

The backtesting engine (`/lib/backtest.ts`) is designed to be conservative and realistic.

### Execution Rules
- **Entry Price**: Buys exactly at the **20-Day High** (Breakout Level), simulating a Stop-Limit order.
- **Liquidity Check**: Skips trades if cash is insufficient.

### Exit Strategies
The engine supports multiple exit modes to optimize returns:

#### A. Weighted Average Target (Default)
- Treats multiple entries as a single average position.
- **Target**: Exits the **entire** position when the price hits `WeightedAvgPrice + Target%` (e.g., 6%).
- **Benefit**: Clears inventory faster and reduces complexity.

#### B. Individual LIFO (Last-In-First-Out)
- Treats each entry as a distinct trade.
- **Target**: Exits specific batches when they hit their individual targets (e.g., 10% for the first buy, 8% for the second).
- **Benefit**: Maximizes gains on early entries while quickly banking profits on later additions.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Git

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/rohitpant788/sst.git
    cd sst
    ```

2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📂 Project Structure

- `app/backtest`: Backtesting UI and logic integration.
- `lib/strategy.ts`: Core definitions of the SST signals (Tracking/Buy).
- `lib/backtest.ts`: The simulation engine that processes historical candles.
- `lib/data.ts`: Data fetching utilities (Yahoo Finance API).

---

## 📝 License
[MIT](LICENSE)

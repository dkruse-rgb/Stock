# TradeTrainer

A Robinhood-style paper trading simulator for learning stocks and crypto without risking real money.

## What it does

- Tracks a watchlist of stocks and crypto
- Refreshes live crypto prices from CoinGecko when available
- Uses simulated fallback data for stock quotes until a stock data API/proxy is added
- Lets users place mock buy and sell trades
- Saves paper account progress in the browser with localStorage
- Shows account equity, cash, positions, P/L, recent trades, and a trade journal

## Tech stack

- React
- Vite
- Tailwind CSS
- Recharts
- Lucide icons
- Framer Motion

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

This repo includes a GitHub Actions workflow that builds the app and publishes the `dist` folder to GitHub Pages.

After the first workflow run, go to:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

## Roadmap

- Add real stock data through a safe backend/proxy
- Add stop-loss and take-profit orders
- Add trade grading and coaching feedback
- Add lessons and strategy replay mode
- Add leaderboard/challenges for paper trading


## Stock APIs Overview

This document summarizes candidate stock market APIs considered as alternatives to Yahoo Finance, and recommends a primary choice for this project.

### Requirements from This App

Based on the current Electron app’s behavior, the stock data provider must support:

- **Symbol and company search**
- **Quotes**
  - Current price, absolute and percent change
  - Market cap, volume
  - Day high/low and 52‑week high/low
  - Type information (e.g. stock vs ETF)
- **Historical data**
  - Daily OHLC + volume
  - At least 1 year of history for charts and tables
- **Financial statements**
  - Income statement (annual and quarterly), including:
    - Total revenue
    - Gross profit
    - Operating income
    - Net income
  - Balance sheet (annual and quarterly), including:
    - Total assets
    - Total liabilities
    - Total stockholders’ equity
- **ETF details**
  - Fund profile and expense ratio
  - Top holdings (symbol, name, weight %)
- **JSON / HTTP API**, suitable for use from the Electron main process

SEC/EDGAR filings are already handled via a separate `edgarService` and are not a requirement for the stock API itself.

### Candidates

- **Financial Modeling Prep (FMP)**
  - Free tier: around **250 requests/day**.
  - Features:
    - Symbol/company search.
    - Real‑time and historical prices (daily OHLC + volume).
    - Financial statements (income statement, balance sheet, and others), annual and quarterly.
    - ETF‑related data including profiles and holdings.
    - Additional fundamentals (analyst estimates, earnings, profiles, etc.) for future expansion.

- **Alpha Vantage**
  - Free tier: **~25 requests/day**, which is tight for this app once search + quote + history + financials + ETF calls are counted.
  - Features:
    - Time series for stocks, FX, crypto.
    - Some fundamentals and ETF data.
  - Main drawback is the low free‑tier quota relative to this app’s usage pattern.

- **IEX Cloud**
  - Free/low‑cost tier with a message‑based quota (e.g. tens of thousands of messages/month).
  - Features:
    - Real‑time and historical U.S. equities data.
    - Company info and some fundamentals.
  - Well suited for quote and chart data; mapping its financials and ETF coverage to the current UI would take more work.

- **Polygon.io (Massive)**
  - Free tier focuses on **end‑of‑day** (EOD) data with limited real‑time access.
  - Strong on time‑series data across equities/FX/crypto.
  - Less focused on full financial statements and ETF holdings in the free tier.

- **Twelve Data**
  - Free tier: several hundred requests/day with per‑minute limits.
  - Features:
    - Time‑series data and technical indicators.
    - Multiple asset classes (stocks, FX, crypto, etc.).
  - Strong charting/time‑series support; less centered on detailed fundamentals and ETF holdings.

### Recommended Primary API

**Financial Modeling Prep (FMP)** is the best fit for this project’s current and future needs:

- **Coverage matches the app**:
  - Search, quotes, historical OHLC + volume.
  - Income statement and balance sheet data with annual and quarterly periods.
  - ETF profile information and holdings to drive the ETF tab.
- **Free tier is workable**:
  - ~250 requests/day is much more comfortable than Alpha Vantage’s 25/day, given that a single symbol view can involve multiple API calls (search, quote, historical, financials, ETF).
- **Future‑proofing**:
  - Exposes richer fundamentals, earnings, analyst estimates, and other data that the app can adopt later without switching providers.

In short, **FMP should be used as the primary stock data provider**, while EDGAR remains the source of truth for SEC filings via the existing `edgarService`.


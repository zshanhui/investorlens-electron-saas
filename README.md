## InvestorLens

InvestorLens is a minimalist desktop research tool for quickly exploring stocks and ETFs. It is built with Electron and primarily uses Financial Modeling Prep (FMP) for stock data, with Yahoo Finance as a fallback, and was vibe coded end‑to‑end inside CursorIDE.

### Features

- **Fast symbol search**: Look up stocks and popular index ETFs by ticker or company name.
- **Interactive price history**: Hoverable ECharts line chart showing roughly 1 year of daily closes.
- **Recent daily history table**: Compact open/high/low/close/volume view.
- **Key quote metrics**: Market cap, volume, 52‑week range, and more.
- **Financial statements**: Income statement and balance sheet snapshots.
- **Light / dark themes**: Toggleable red‑and‑gold themed UI for day and night sessions.

### Getting started

```bash
npm install
npm start
```

This will launch the InvestorLens Electron app in a desktop window.

### Configuring the FMP API key

InvestorLens uses [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs#directory) as the primary stock data provider.
You need an API key from FMP to use it.

Set the key in your environment before starting the app:

```bash
export FMP_API_KEY=your_key_here
npm start
```

If the FMP API key is missing, invalid, or rate‑limited, the app will automatically fall back to the existing Yahoo Finance integration where possible.


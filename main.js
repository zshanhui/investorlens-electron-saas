const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const fs = require('fs')
const path = require('path')
const https = require('https')
const { pathToFileURL } = require('url')
const yaml = require('js-yaml')

let i18nTranslations = { en: {}, zh: {} }
try {
  const yamlPath = path.join(__dirname, 'translations.yaml')
  const parsed = yaml.load(fs.readFileSync(yamlPath, 'utf8'))
  if (parsed && parsed.en) i18nTranslations.en = parsed.en
  if (parsed && parsed.zh) i18nTranslations.zh = parsed.zh
} catch (err) {
  console.error('Failed to load translations.yaml:', err.message)
}

let edgarService
function getEdgarService () {
  if (!edgarService) edgarService = require('./edgarService')
  return edgarService
}

let yahooFinance

const loadYahooFinance = async () => {
  if (yahooFinance) return yahooFinance
  const mod = await import('yahoo-finance2')
  // v3 of yahoo-finance2 exports a class, so we must instantiate it
  const YahooFinance = mod.default
  yahooFinance = new YahooFinance()
  return yahooFinance
}

// ----- FinancialModelingPrep (FMP) client -----

const FMP_BASE_URL = 'https://financialmodelingprep.com'

function getFmpApiKey () {
  const key = process.env.FMP_API_KEY
  if (!key) {
    return null
  }
  return key.trim()
}

function buildFmpUrl (pathname, params = {}) {
  const apiKey = getFmpApiKey()
  if (!apiKey) {
    throw new Error('FMP API key missing. Please set FMP_API_KEY in your environment.')
  }

  const url = new URL('/stable/' + pathname.replace(/^\//, ''), FMP_BASE_URL)
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    url.searchParams.set(k, String(v))
  })
  url.searchParams.set('apikey', apiKey)
  return url.toString()
}

function callFmpJson (pathname, params = {}) {
  let fullUrl
  try {
    fullUrl = buildFmpUrl(pathname, params)
  } catch (err) {
    return Promise.reject(err)
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      fullUrl,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'InvestorLens/1.0 (FMP client)'
        },
        timeout: 15000
      },
      (res) => {
        const { statusCode } = res
        if (statusCode < 200 || statusCode >= 300) {
          res.resume()
          if (statusCode === 401 || statusCode === 403) {
            return reject(new Error('FMP API key missing/invalid (HTTP ' + statusCode + ').'))
          }
          if (statusCode === 429) {
            return reject(new Error('FMP rate limit exceeded. Please try again later.'))
          }
          return reject(new Error(`FMP request failed with status ${statusCode}.`))
        }

        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (err) {
            reject(new Error('Failed to parse FMP response JSON: ' + (err.message || err)))
          }
        })
      }
    )

    req.on('error', (err) => {
      reject(new Error('FMP request error: ' + (err.message || err)))
    })

    req.on('timeout', () => {
      req.destroy(new Error('FMP request timed out'))
    })
  })
}

async function fetchFmpSearch (query) {
  const trimmed = String(query || '').trim()
  if (!trimmed) return []

  // Use symbol search first; if it returns nothing, try name search.
  let results = []
  try {
    results = await callFmpJson('search-symbol', { query: trimmed })
  } catch (err) {
    throw err
  }

  if (!Array.isArray(results) || results.length === 0) {
    const byName = await callFmpJson('search-name', { query: trimmed })
    if (Array.isArray(byName)) results = byName
  }

  if (!Array.isArray(results)) return []

  // Normalize to a shape the renderer can easily consume.
  return results.map((item) => ({
    symbol: item.symbol || item.ticker || '',
    type: item.type || item.assetType || '',
    name: item.name || item.companyName || ''
  })).filter((r) => r.symbol)
}

async function fetchFmpQuote (symbol) {
  const sym = String(symbol || '').trim()
  if (!sym) {
    throw new Error('Missing symbol')
  }

  const data = await callFmpJson('quote', { symbol: sym })
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No FMP quote data for symbol ' + sym)
  }
  const q = data[0]

  const price = q.price != null ? Number(q.price) : null
  const prevClose = q.previousClose != null ? Number(q.previousClose) : null
  let change = null
  let changePercent = null
  if (price != null && prevClose != null && prevClose !== 0) {
    change = price - prevClose
    changePercent = (change / prevClose) * 100
  } else if (q.change != null) {
    change = Number(q.change)
  }
  if (q.changesPercentage != null && changePercent == null) {
    changePercent = Number(String(q.changesPercentage).replace('%', ''))
  }

  const isEtf =
    String(q.type || q.assetType || '').toUpperCase().includes('ETF') ||
    String(q.name || '').toUpperCase().includes('ETF')

  return {
    symbol: q.symbol || sym,
    shortName: q.name || sym,
    longName: q.name || sym,
    quoteType: isEtf ? 'ETF' : 'EQUITY',
    regularMarketPrice: price,
    price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    marketCap: q.marketCap != null ? Number(q.marketCap) : null,
    regularMarketVolume: q.volume != null ? Number(q.volume) : null,
    regularMarketDayHigh: q.dayHigh != null ? Number(q.dayHigh) : null,
    regularMarketDayLow: q.dayLow != null ? Number(q.dayLow) : null,
    fiftyTwoWeekHigh: q.yearHigh != null ? Number(q.yearHigh) : null,
    fiftyTwoWeekLow: q.yearLow != null ? Number(q.yearLow) : null,
    trailingPE: q.pe != null ? Number(q.pe) : null,
    priceToBook: q.priceAvg50 != null && q.priceAvg50 !== 0 && q.price != null
      ? Number(q.price) / Number(q.priceAvg50)
      : null,
    priceToSalesTrailing12Months: q.priceToSalesTTM != null ? Number(q.priceToSalesTTM) : null
  }
}

async function fetchFmpHistorical (symbol, from, to) {
  const sym = String(symbol || '').trim()
  if (!sym) throw new Error('Missing symbol')

  const json = await callFmpJson('historical-price-eod/full', {
    symbol: sym,
    from,
    to
  })

  const rows = Array.isArray(json?.historical) ? json.historical : (Array.isArray(json) ? json : [])
  if (!Array.isArray(rows)) return []

  return rows
    .map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume
    }))
    .filter((r) => r.date)
}

async function fetchFmpFinancials (symbol) {
  const sym = String(symbol || '').trim()
  if (!sym) throw new Error('Missing symbol')

  const [income, balance] = await Promise.all([
    callFmpJson('income-statement', { symbol: sym, period: 'annual', limit: 8 }),
    callFmpJson('balance-sheet-statement', { symbol: sym, period: 'annual', limit: 8 })
  ])

  const incomeAnnual = (Array.isArray(income) ? income : []).map((r) => ({
    date: r.date || r.calendarYear || r.fillingDate,
    endDate: r.date || r.calendarYear || r.fillingDate,
    totalRevenue: r.revenue ?? r.totalRevenue,
    grossProfit: r.grossProfit,
    operatingIncome: r.operatingIncome,
    netIncome: r.netIncome
  }))

  const balanceAnnual = (Array.isArray(balance) ? balance : []).map((r) => ({
    date: r.date || r.calendarYear || r.fillingDate,
    endDate: r.date || r.calendarYear || r.fillingDate,
    totalAssets: r.totalAssets,
    totalLiab: r.totalLiabilities ?? r.totalLiabilitiesAndTotalEquity,
    totalStockholderEquity: r.totalEquity ?? r.totalStockholdersEquity
  }))

  return {
    incomeAnnual,
    incomeQuarterly: [],
    balanceAnnual,
    balanceQuarterly: []
  }
}

async function fetchFmpEtfDetails (symbol) {
  const sym = String(symbol || '').trim()
  if (!sym) throw new Error('Missing symbol')

  const [info, holdings] = await Promise.all([
    callFmpJson('etf/info', { symbol: sym }),
    callFmpJson('etf/holdings', { symbol: sym })
  ])

  const infoItem = Array.isArray(info) && info.length > 0 ? info[0] : info
  const holdingsArr = Array.isArray(holdings?.holdings) ? holdings.holdings : (Array.isArray(holdings) ? holdings : [])

  const expenseRatio =
    infoItem?.expenseRatio ||
    infoItem?.netExpenseRatio ||
    infoItem?.totalExpenseRatio ||
    null

  const topHoldings = {
    holdings: holdingsArr.map((h) => ({
      symbol: h.asset ?? h.symbol,
      holdingName: h.name ?? h.assetName ?? h.asset,
      holdingPercent: h.weightPercentage != null ? Number(h.weightPercentage) / 100 : null
    }))
  }

  return {
    fundProfile: {
      feesExpensesInvestment: {
        netExpRatio: expenseRatio
      }
    },
    topHoldings,
    fundPerformance: {},
    quoteType: { quoteType: 'ETF' }
  }
}

// ----- Price alert storage -----

function getAlertsPath () {
  return path.join(app.getPath('userData'), 'alerts.json')
}

function loadAlerts () {
  try {
    const raw = fs.readFileSync(getAlertsPath(), 'utf8')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.alerts)) return parsed.alerts
    return []
  } catch (_) {
    return []
  }
}

function saveAlerts (alerts) {
  try {
    const payload = { alerts: Array.isArray(alerts) ? alerts : [] }
    fs.writeFileSync(getAlertsPath(), JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to save alerts.json:', err.message)
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile('index.html')
}

ipcMain.handle('stock:search', async (_event, query) => {
  // Try FMP first, then fall back to Yahoo search if anything fails.
  try {
    const fmpResults = await fetchFmpSearch(query)
    if (Array.isArray(fmpResults) && fmpResults.length > 0) {
      return { ok: true, data: fmpResults }
    }
  } catch (err) {
    console.warn('FMP search failed, falling back to Yahoo Finance:', err.message)
  }

  try {
    const yf = await loadYahooFinance()
    const results = await yf.search(query)
    return { ok: true, data: results }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stock:quote', async (_event, symbol) => {
  // Try FMP quote first, then fall back to Yahoo.
  try {
    const fmpQuote = await fetchFmpQuote(symbol)
    return { ok: true, data: fmpQuote }
  } catch (err) {
    console.warn('FMP quote failed, falling back to Yahoo Finance:', err.message)
  }

  try {
    const yf = await loadYahooFinance()
    const quote = await yf.quote(symbol)
    // Fetch summaryDetail for P/S (priceToSalesTrailing12Months); quote() already has P/E, P/B
    try {
      const summary = await yf.quoteSummary(symbol, { modules: ['summaryDetail'] })
      const sd = summary.summaryDetail
      if (sd && sd.priceToSalesTrailing12Months != null) {
        quote.priceToSalesTrailing12Months = sd.priceToSalesTrailing12Months
      }
    } catch (_) {}
    return { ok: true, data: quote }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stock:historical', async (_event, symbol, period1, period2) => {
  // Try FMP daily EOD first, then fall back to Yahoo historical.
  try {
    const history = await fetchFmpHistorical(symbol, period1, period2)
    if (Array.isArray(history) && history.length > 0) {
      return { ok: true, data: history }
    }
  } catch (err) {
    console.warn('FMP historical failed, falling back to Yahoo Finance:', err.message)
  }

  try {
    const yf = await loadYahooFinance()
    const history = await yf.historical(symbol, { period1, period2 })
    return { ok: true, data: history }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stock:financials', async (_event, symbol) => {
  // Try FMP financial statements first, then fall back to Yahoo quoteSummary.
  try {
    const fmpData = await fetchFmpFinancials(symbol)
    const hasAny =
      (Array.isArray(fmpData.incomeAnnual) && fmpData.incomeAnnual.length > 0) ||
      (Array.isArray(fmpData.balanceAnnual) && fmpData.balanceAnnual.length > 0)

    if (hasAny) {
      return { ok: true, data: fmpData }
    }
  } catch (err) {
    console.warn('FMP financials failed, falling back to Yahoo Finance:', err.message)
  }

  try {
    const yf = await loadYahooFinance()
    const raw = await yf.quoteSummary(symbol, {
      modules: [
        'incomeStatementHistory',
        'incomeStatementHistoryQuarterly',
        'balanceSheetHistory',
        'balanceSheetHistoryQuarterly'
      ]
    })

    const incomeAnnual = raw.incomeStatementHistory?.incomeStatementHistory || []
    const incomeQuarterly = raw.incomeStatementHistoryQuarterly?.incomeStatementHistory || []
    const balanceAnnual = raw.balanceSheetHistory?.balanceSheetStatements || []
    const balanceQuarterly = raw.balanceSheetHistoryQuarterly?.balanceSheetStatements || []

    return {
      ok: true,
      data: {
        incomeAnnual,
        incomeQuarterly,
        balanceAnnual,
        balanceQuarterly
      }
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stock:etfDetails', async (_event, symbol) => {
  // Try FMP ETF info/holdings first, then fall back to Yahoo.
  try {
    const fmpEtf = await fetchFmpEtfDetails(symbol)
    return { ok: true, data: fmpEtf }
  } catch (err) {
    console.warn('FMP ETF details failed, falling back to Yahoo Finance:', err.message)
  }

  try {
    const yf = await loadYahooFinance()
    const raw = await yf.quoteSummary(symbol, {
      modules: ['fundProfile', 'topHoldings', 'fundPerformance', 'quoteType']
    })
    return {
      ok: true,
      data: {
        fundProfile: raw.fundProfile,
        topHoldings: raw.topHoldings,
        fundPerformance: raw.fundPerformance,
        quoteType: raw.quoteType
      }
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ----- Price alerts IPC -----

ipcMain.handle('alerts:getAll', async () => {
  try {
    const alerts = loadAlerts()
    return { ok: true, data: alerts }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('alerts:add', async (_event, payload) => {
  try {
    if (!payload || typeof payload.symbol !== 'string') {
      throw new Error('Invalid alert payload')
    }

    const alerts = loadAlerts()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const condition = payload.condition === 'below' ? 'below' : 'above'
    const targetPrice = Number(payload.targetPrice)
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      throw new Error('Invalid target price')
    }

    const alert = {
      id,
      symbol: payload.symbol.toUpperCase(),
      condition,
      targetPrice,
      createdAt: new Date().toISOString()
    }

    alerts.push(alert)
    saveAlerts(alerts)
    return { ok: true, data: alert }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('alerts:remove', async (_event, id) => {
  try {
    if (!id) return { ok: true, data: false }
    const alerts = loadAlerts()
    const next = alerts.filter((a) => a.id !== id)
    if (next.length !== alerts.length) {
      saveAlerts(next)
      return { ok: true, data: true }
    }
    return { ok: true, data: false }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('alerts:update', async (_event, payload) => {
  try {
    if (!payload || !payload.id) {
      throw new Error('Missing alert id')
    }

    const alerts = loadAlerts()
    const idx = alerts.findIndex((a) => a.id === payload.id)
    if (idx === -1) {
      throw new Error('Alert not found')
    }

    const updated = { ...alerts[idx] }

    if (payload.condition) {
      updated.condition = payload.condition === 'below' ? 'below' : 'above'
    }

    if (payload.targetPrice != null) {
      const targetPrice = Number(payload.targetPrice)
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        throw new Error('Invalid target price')
      }
      updated.targetPrice = targetPrice
    }

    alerts[idx] = updated
    saveAlerts(alerts)
    return { ok: true, data: updated }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ----- Price alerts checker -----

let alertsInterval = null

async function checkAlerts () {
  let alerts = []
  try {
    alerts = loadAlerts()
  } catch (err) {
    console.error('checkAlerts: failed to load alerts', err)
    return
  }

  if (!Array.isArray(alerts) || alerts.length === 0) return

  const bySymbol = new Map()
  for (const alert of alerts) {
    if (!alert || !alert.symbol) continue
    const symbol = String(alert.symbol).toUpperCase()
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, [])
    bySymbol.get(symbol).push(alert)
  }

  if (bySymbol.size === 0) return

  let yf
  try {
    yf = await loadYahooFinance()
  } catch (err) {
    console.error('checkAlerts: failed to load yahoo-finance2', err)
    return
  }

  const remaining = [...alerts]
  let changed = false

  for (const [symbol, symbolAlerts] of bySymbol.entries()) {
    let quote
    try {
      quote = await yf.quote(symbol)
    } catch (err) {
      console.error('checkAlerts: quote failed for', symbol, err.message)
      continue
    }

    const priceRaw = quote.regularMarketPrice ?? quote.price
    const currentPrice = Number(priceRaw)
    if (!Number.isFinite(currentPrice)) continue

    for (const alert of symbolAlerts) {
      const target = Number(alert.targetPrice)
      if (!Number.isFinite(target) || target <= 0) continue

      let triggered = false
      if (alert.condition === 'below' && currentPrice <= target) triggered = true
      if (alert.condition === 'above' && currentPrice >= target) triggered = true
      if (!triggered) continue

      changed = true

      try {
        const body =
          `${symbol} is ${alert.condition} ` +
          target.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) +
          ` (now ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`

        new Notification({
          title: 'Price Alert',
          body
        }).show()
      } catch (err) {
        console.error('checkAlerts: failed to show notification', err)
      }

      const idx = remaining.findIndex((a) => a.id === alert.id)
      if (idx !== -1) remaining.splice(idx, 1)
    }
  }

  if (changed) {
    try {
      saveAlerts(remaining)
    } catch (err) {
      console.error('checkAlerts: failed to save alerts', err)
    }
  }
}

// EDGAR SEC filings
ipcMain.handle('edgar:searchCompany', async (_event, query) => {
  try {
    const companies = await getEdgarService().searchCompany(query)
    return { ok: true, data: companies }
  } catch (err) {
    console.error('edgar:searchCompany', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('edgar:getFilings', async (_event, { cik, forms }) => {
  try {
    const filings = await getEdgarService().getCompanyFilings(cik, forms)
    return { ok: true, data: filings }
  } catch (err) {
    console.error('edgar:getFilings', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('edgar:downloadPdf', async (_event, { cik, accessionNumber, primaryDocument }) => {
  try {
    const pdfPath = await getEdgarService().downloadFilingPdf(cik, accessionNumber, primaryDocument)
    return { ok: true, path: pdfPath }
  } catch (err) {
    console.error('edgar:downloadPdf', err)
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('i18n:get', () => i18nTranslations)

ipcMain.handle('edgar:openPdf', (_event, pdfPath) => {
  if (!pdfPath || typeof pdfPath !== 'string') return
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadURL(pathToFileURL(pdfPath).href)
})

app.whenReady().then(() => {
  createWindow()

  // Start periodic price alert checks while the app is running.
  alertsInterval = setInterval(() => {
    checkAlerts().catch((err) => {
      console.error('checkAlerts interval error', err)
    })
  }, 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (alertsInterval) {
    clearInterval(alertsInterval)
    alertsInterval = null
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

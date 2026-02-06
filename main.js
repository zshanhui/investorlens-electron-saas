const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const fs = require('fs')
const path = require('path')
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
  try {
    const yf = await loadYahooFinance()
    const results = await yf.search(query)
    return { ok: true, data: results }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stock:quote', async (_event, symbol) => {
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
  try {
    const yf = await loadYahooFinance()
    const history = await yf.historical(symbol, { period1, period2 })
    return { ok: true, data: history }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('stock:financials', async (_event, symbol) => {
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

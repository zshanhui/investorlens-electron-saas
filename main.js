const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

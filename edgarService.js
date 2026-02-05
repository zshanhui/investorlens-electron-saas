const { app, BrowserWindow } = require('electron')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Basic SEC guidance: identify your app and provide a contact
const USER_AGENT = 'my-electron-app/1.0 (contact: example@example.com)'

const SEC_DATA_HOST = 'data.sec.gov'
const SEC_FILES_HOST = 'www.sec.gov'

// Simple rate limiter: keep at least 150ms between outgoing SEC requests
let lastRequestTime = 0
const MIN_INTERVAL_MS = 150
const MAX_RETRIES = 3
const RETRY_BACKOFF_MS = 1000

async function throttle () {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

function httpsGetJsonOnce (url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json'
          }
        },
        (res) => {
          const { statusCode } = res
          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            res.resume()
            return resolve(httpsGetJson(res.headers.location))
          }

          if (statusCode === 429 || statusCode === 503) {
            res.resume()
            return reject(new Error('RATE_LIMIT'))
          }

          if (statusCode < 200 || statusCode >= 300) {
            res.resume()
            return reject(
              new Error(`Request failed with status ${statusCode} for ${url}`)
            )
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
              reject(
                new Error(
                  `Failed to parse JSON from ${url}: ${err.message || err}`
                )
              )
            }
          })
        }
      )
      .on('error', (err) => {
        reject(err)
      })
  })
}

async function httpsGetJson (url, attempt = 0) {
  await throttle()
  try {
    return await httpsGetJsonOnce(url)
  } catch (err) {
    if (err.message === 'RATE_LIMIT' && attempt < MAX_RETRIES) {
      const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
      return httpsGetJson(url, attempt + 1)
    }
    throw err.message === 'RATE_LIMIT'
      ? new Error('SEC rate limit exceeded. Please try again in a moment.')
      : err
  }
}

function httpsGetBufferOnce (url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': USER_AGENT
          }
        },
        (res) => {
          const { statusCode } = res
          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            res.resume()
            return resolve(httpsGetBuffer(res.headers.location))
          }

          if (statusCode === 429 || statusCode === 503) {
            res.resume()
            return reject(new Error('RATE_LIMIT'))
          }

          if (statusCode < 200 || statusCode >= 300) {
            res.resume()
            return reject(
              new Error(`Request failed with status ${statusCode} for ${url}`)
            )
          }

          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            resolve(Buffer.concat(chunks))
          })
        }
      )
      .on('error', (err) => {
        reject(err)
      })
  })
}

async function httpsGetBuffer (url, attempt = 0) {
  await throttle()
  try {
    return await httpsGetBufferOnce(url)
  } catch (err) {
    if (err.message === 'RATE_LIMIT' && attempt < MAX_RETRIES) {
      const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
      return httpsGetBuffer(url, attempt + 1)
    }
    throw err.message === 'RATE_LIMIT'
      ? new Error('SEC rate limit exceeded. Please try again in a moment.')
      : err
  }
}

// --- Company ticker → CIK resolution ---

let tickerMapCache = null

function getUserDataPath () {
  try {
    return app.getPath('userData')
  } catch {
    return process.cwd()
  }
}

async function loadTickerMap () {
  if (tickerMapCache) return tickerMapCache

  const cachePath = path.join(getUserDataPath(), 'edgar-company-tickers.json')

  if (fs.existsSync(cachePath)) {
    try {
      const raw = fs.readFileSync(cachePath, 'utf8')
      const json = JSON.parse(raw)
      tickerMapCache = json
      return tickerMapCache
    } catch {
      // fall through to refetch
    }
  }

  const url = 'https://www.sec.gov/files/company_tickers.json'
  const json = await httpsGetJson(url)

  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })
    fs.writeFileSync(cachePath, JSON.stringify(json), 'utf8')
  } catch {
    // best effort cache
  }

  tickerMapCache = json
  return tickerMapCache
}

function normalizeCik (cikStr) {
  if (!cikStr) return null
  const n = parseInt(String(cikStr).replace(/^0+/, ''), 10)
  if (!Number.isFinite(n)) return null
  return String(n)
}

function padCik10 (cikStr) {
  const n = normalizeCik(cikStr)
  if (!n) return null
  return n.padStart(10, '0')
}

async function searchCompany (query) {
  const q = String(query || '').trim()
  if (!q) {
    return []
  }

  const map = await loadTickerMap()
  const lower = q.toLowerCase()

  const matches = []
  for (const key of Object.keys(map)) {
    const item = map[key]
    const ticker = String(item.ticker || '').toLowerCase()
    const name = String(item.title || '').toLowerCase()
    if (ticker.includes(lower) || name.includes(lower)) {
      const cikNorm = normalizeCik(item.cik_str)
      matches.push({
        cik: padCik10(item.cik_str),
        cikNumeric: cikNorm,
        ticker: item.ticker,
        name: item.title
      })
    }
    if (matches.length >= 25) break
  }

  // Basic ranking: exact ticker first, then prefix, then others
  matches.sort((a, b) => {
    const tA = a.ticker.toLowerCase()
    const tB = b.ticker.toLowerCase()
    if (tA === lower && tB !== lower) return -1
    if (tB === lower && tA !== lower) return 1
    if (tA.startsWith(lower) && !tB.startsWith(lower)) return -1
    if (tB.startsWith(lower) && !tA.startsWith(lower)) return 1
    return a.ticker.localeCompare(b.ticker)
  })

  return matches
}

// --- Filings listing ---

async function getCompanyFilings (cik, forms) {
  const cikPadded = padCik10(cik)
  if (!cikPadded) {
    throw new Error('Invalid CIK')
  }

  const url = `https://${SEC_DATA_HOST}/submissions/CIK${cikPadded}.json`
  const json = await httpsGetJson(url)

  const filings = json.filings && json.filings.recent
  if (!filings) {
    return []
  }

  const filterForms =
    Array.isArray(forms) && forms.length > 0
      ? new Set(forms.map((f) => f.toUpperCase()))
      : null

  const result = []
  const accessions = filings.accessionNumber || []
  const dates = filings.filingDate || []
  const reportDates = filings.reportDate || []
  const formsArr = filings.form || []
  const primaryDocs = filings.primaryDocument || []
  const descriptions = filings.primaryDocDescription || []

  for (let i = 0; i < accessions.length; i++) {
    const form = String(formsArr[i] || '').toUpperCase()
    if (filterForms && !filterForms.has(form)) continue

    result.push({
      cik: padCik10(json.cik || cikPadded),
      cikNumeric: normalizeCik(json.cik || cikPadded),
      accessionNumber: accessions[i],
      form,
      filingDate: dates[i],
      reportDate: reportDates[i],
      primaryDocument: primaryDocs[i],
      description: descriptions[i] || null
    })

    if (result.length >= 100) break
  }

  return result
}

// --- Filing documents & PDF download ---

async function getFilingDocuments (cik, accessionNumber, primaryDocument) {
  const cikNumeric = normalizeCik(cik)
  if (!cikNumeric) {
    throw new Error('Invalid CIK')
  }

  const accNoNoDashes = String(accessionNumber).replace(/-/g, '')
  const basePath = `/Archives/edgar/data/${cikNumeric}/${accNoNoDashes}/`
  const indexUrl = `https://${SEC_FILES_HOST}${basePath}index.json`

  let indexJson = null
  try {
    indexJson = await httpsGetJson(indexUrl)
  } catch (_) {
    // Some older filings may not have index.json; fall back to primary doc only
  }

  let pdfUrl = null
  if (indexJson && indexJson.directory && Array.isArray(indexJson.directory.item)) {
    const items = indexJson.directory.item
    const pdfItem = items.find((it) =>
      String(it.name || '').toLowerCase().endsWith('.pdf')
    )
    if (pdfItem) {
      pdfUrl = `https://${SEC_FILES_HOST}${basePath}${pdfItem.name}`
    }
  }

  const primaryDocName = primaryDocument || (indexJson && indexJson.directory && indexJson.directory.item && indexJson.directory.item[0] && indexJson.directory.item[0].name)

  const primaryDocUrl = primaryDocName
    ? `https://${SEC_FILES_HOST}${basePath}${primaryDocName}`
    : null

  return { pdfUrl, primaryDocUrl }
}

function ensureDir (dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (_) {}
}

function getPdfPath (cik, accessionNumber) {
  const dir = path.join(getUserDataPath(), 'edgar-pdfs')
  ensureDir(dir)
  const safeCik = normalizeCik(cik) || 'unknown'
  const safeAcc = String(accessionNumber).replace(/[^0-9A-Za-z]/g, '')
  return path.join(dir, `${safeCik}-${safeAcc}.pdf`)
}

async function downloadFileToPath (url, destPath) {
  const buffer = await httpsGetBuffer(url)
  await fs.promises.writeFile(destPath, buffer)
  return destPath
}

async function htmlToPdf (url, destPath) {
  return new Promise((resolve, reject) => {
    let win

    try {
      win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      })
    } catch (err) {
      return reject(err)
    }

    const cleanup = (err) => {
      if (win && !win.isDestroyed()) {
        win.close()
      }
      if (err) reject(err)
      else resolve(destPath)
    }

    win.webContents.once('did-fail-load', (_event, code, desc) => {
      cleanup(new Error(`Failed to load filing HTML (${code}): ${desc}`))
    })

    win.webContents.once('did-finish-load', async () => {
      try {
        const pdfData = await win.webContents.printToPDF({
          printBackground: true
        })
        await fs.promises.writeFile(destPath, pdfData)
        cleanup()
      } catch (err) {
        cleanup(err)
      }
    })

    win.loadURL(url, { userAgent: USER_AGENT }).catch((err) => cleanup(err))
  })
}

async function downloadFilingPdf (cik, accessionNumber, primaryDocument) {
  const destPath = getPdfPath(cik, accessionNumber)
  // If already downloaded, just reuse
  if (fs.existsSync(destPath)) {
    return destPath
  }

  const { pdfUrl, primaryDocUrl } = await getFilingDocuments(
    cik,
    accessionNumber,
    primaryDocument
  )

  if (pdfUrl) {
    return downloadFileToPath(pdfUrl, destPath)
  }

  if (!primaryDocUrl) {
    throw new Error('No available document found for this filing')
  }

  return htmlToPdf(primaryDocUrl, destPath)
}

module.exports = {
  searchCompany,
  getCompanyFilings,
  downloadFilingPdf
}


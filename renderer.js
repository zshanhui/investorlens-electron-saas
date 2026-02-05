const searchInput = document.getElementById('searchInput')
const searchBtn = document.getElementById('searchBtn')
const resultsList = document.getElementById('resultsList')
const resultsHint = document.getElementById('resultsHint')
const themeToggle = document.getElementById('themeToggle')
const quickTiles = document.querySelectorAll('.quick-tile')
const etfTiles = document.querySelectorAll('.etf-tile')
const quotePanel = document.getElementById('quotePanel')
const detailHint = document.getElementById('detailHint')
const loadingEl = document.getElementById('loading')
const errorEl = document.getElementById('error')

const quoteSymbol = document.getElementById('quoteSymbol')
const quoteName = document.getElementById('quoteName')
const quotePrice = document.getElementById('quotePrice')
const quoteChange = document.getElementById('quoteChange')
const quoteMeta = document.getElementById('quoteMeta')
const historyBody = document.getElementById('historyBody')
const historyChart = document.getElementById('historyChart')

const tabQuote = document.getElementById('tabQuote')
const tabFinancials = document.getElementById('tabFinancials')
const tabEdgar = document.getElementById('tabEdgar')
const financialsPanel = document.getElementById('financialsPanel')
const edgarPanel = document.getElementById('edgarPanel')
const edgarHint = document.getElementById('edgarHint')
const edgarSearchInput = document.getElementById('edgarSearchInput')
const edgarSearchBtn = document.getElementById('edgarSearchBtn')
const edgarSearchBar = document.querySelector('.edgar-search-bar')
const edgarCompanyList = document.getElementById('edgarCompanyList')
const edgarSelectedCompany = document.getElementById('edgarSelectedCompany')
const edgarFormFilter = document.getElementById('edgarFormFilter')
const edgarFilingsWrap = document.getElementById('edgarFilingsWrap')
const edgarFilingsBody = document.getElementById('edgarFilingsBody')
const edgarFilingsHint = document.getElementById('edgarFilingsHint')
const financialsStatus = document.getElementById('financialsStatus')
const incomeHead = document.getElementById('incomeHead')
const incomeBody = document.getElementById('incomeBody')
const balanceHead = document.getElementById('balanceHead')
const balanceBody = document.getElementById('balanceBody')
const incomeTableWrap = document.getElementById('incomeTableWrap')
const balanceTableWrap = document.getElementById('balanceTableWrap')
const subtabIncome = document.getElementById('subtabIncome')
const subtabBalance = document.getElementById('subtabBalance')
const tabEtf = document.getElementById('tabEtf')
const etfPanel = document.getElementById('etfPanel')
const etfStatus = document.getElementById('etfStatus')
const etfExpenseSection = document.getElementById('etfExpenseSection')
const etfExpenseValue = document.getElementById('etfExpenseValue')
const etfHoldingsSection = document.getElementById('etfHoldingsSection')
const etfHoldingsList = document.getElementById('etfHoldingsList')
const etfComingSoon = document.getElementById('etfComingSoon')

let currentSymbol = null
let currentIsEtf = false
let financialsLoadedFor = null
let etfDetailsLoadedFor = null
let historyChartInstance = null
let currentEdgarCompany = null
let edgarFilings = []

// Theme handling
function applyThemeFromStorage () {
  try {
    const saved = window.localStorage.getItem('theme')
    if (saved === 'light') {
      document.body.classList.add('light-theme')
    } else if (saved === 'dark') {
      document.body.classList.remove('light-theme')
    }
  } catch (_) {}

  updateThemeToggleLabel()
}

function updateThemeToggleLabel () {
  if (!themeToggle) return
  const isLight = document.body.classList.contains('light-theme')
  themeToggle.textContent = isLight ? 'Dark mode' : 'Light mode'
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme')
    try {
      window.localStorage.setItem('theme', isLight ? 'light' : 'dark')
    } catch (_) {}
    updateThemeToggleLabel()
    if (historyChartInstance) {
      historyChartInstance.resize()
    }
  })
}

function showLoading (show) {
  loadingEl.classList.toggle('hidden', !show)
}

function showError (message) {
  if (!message) {
    errorEl.classList.add('hidden')
    return
  }
  errorEl.textContent = message
  errorEl.classList.remove('hidden')
  setTimeout(() => errorEl.classList.add('hidden'), 5000)
}

function formatNum (n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (Number.isNaN(x)) return '—'
  if (Math.abs(x) >= 1e9) return (x / 1e9).toFixed(2) + 'B'
  if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(2) + 'M'
  if (Math.abs(x) >= 1e3) return (x / 1e3).toFixed(2) + 'K'
  return x.toLocaleString()
}

function formatDate (d) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString()
}

function formatPrice (n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (Number.isNaN(x)) return '—'
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function escapeHtml (s) {
  if (s == null) return ''
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

function renderHistoryChart (rows) {
  if (!historyChart) return

  if (!Array.isArray(rows) || rows.length === 0) {
    historyChart.innerHTML = '<div class="history-chart-empty">No chart data</div>'
    return
  }

  const points = rows
    .filter(r => r && r.close != null && r.date)
    .slice(-252) // roughly last 1 trading year

  if (points.length === 0) {
    historyChart.innerHTML = '<div class="history-chart-empty">No chart data</div>'
    return
  }

  const closes = points.map(p => Number(p.close))
  const first = closes[0]
  const last = closes[closes.length - 1]
  const positive = last >= first
  const strokeColor = positive ? '#3fb950' : '#f85149'

  const data = points.map(p => {
    const d = typeof p.date === 'string' ? new Date(p.date) : p.date
    return [d.getTime(), Number(p.close)]
  })

  if (historyChartInstance) {
    historyChartInstance.dispose()
    historyChartInstance = null
  }

  if (typeof echarts === 'undefined') {
    historyChart.innerHTML = '<div class="history-chart-empty">Chart library failed to load</div>'
    return
  }

  historyChartInstance = echarts.init(historyChart)

  const option = {
    animation: true,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: { backgroundColor: '#1f2937' }
      },
      valueFormatter: (value) => (value == null ? '—' : formatPrice(value))
    },
    grid: {
      left: 40,
      right: 16,
      top: 10,
      bottom: 26
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#445469' } },
      axisLabel: {
        color: '#8b9eb0'
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: '#445469' } },
      axisLabel: {
        color: '#8b9eb0',
        formatter: (val) => {
          if (val == null || val === '') return '—'
          const x = Number(val)
          if (Number.isNaN(x)) return '—'
          // Drop .00 but keep up to 2 decimals when needed
          return x.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          })
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(136, 153, 168, 0.2)'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        throttle: 50
      }
    ],
    series: [
      {
        type: 'line',
        name: 'Close',
        showSymbol: false,
        smooth: true,
        lineStyle: {
          color: strokeColor,
          width: 2
        },
        areaStyle: {
          color: positive
            ? 'rgba(63, 185, 80, 0.25)'
            : 'rgba(248, 81, 73, 0.25)'
        },
        data
      }
    ]
  }

  historyChartInstance.setOption(option)
}

async function doSearch () {
  const query = searchInput.value.trim()
  if (!query) return

  resultsList.innerHTML = ''
  resultsHint.classList.add('hidden')
  showLoading(true)
  showError(null)

  const result = await window.stockApi.search(query)
  showLoading(false)

  if (!result.ok) {
    showError(result.error || 'Search failed')
    resultsHint.textContent = 'Search failed. Try again.'
    resultsHint.classList.remove('hidden')
    return
  }

  // yahoo-finance2 v3 search() returns an array of matches
  const items = Array.isArray(result.data) ? result.data : (result.data?.quotes || [])
  if (!items || items.length === 0) {
    resultsHint.textContent = 'No results found.'
    resultsHint.classList.remove('hidden')
    return
  }

  resultsHint.classList.add('hidden')
  items.forEach((item) => {
    const div = document.createElement('div')
    div.className = 'result-item'
    div.innerHTML = `
      <span class="symbol">${escapeHtml(item.symbol || '')}</span>
      <span class="type">${escapeHtml(item.quoteType || '')}</span>
      <span class="name">${escapeHtml(item.shortname || item.longname || '')}</span>
    `
    div.addEventListener('click', () => selectSymbol(item.symbol))
    resultsList.appendChild(div)
  })
}

async function selectSymbol (symbol) {
  if (!symbol) return

  currentSymbol = symbol
  financialsLoadedFor = null
  etfDetailsLoadedFor = null

  detailHint.classList.add('hidden')
  quotePanel.classList.remove('hidden')
  quoteSymbol.textContent = symbol
  quoteName.textContent = 'Loading…'
  quotePrice.textContent = '—'
  quoteChange.textContent = ''
  quoteMeta.innerHTML = ''
  historyBody.innerHTML = ''
  if (historyChart) historyChart.innerHTML = ''
  financialsStatus.textContent = 'Click the Financials tab to load statements.'
  incomeHead.innerHTML = ''
  incomeBody.innerHTML = ''
  balanceHead.innerHTML = ''
  balanceBody.innerHTML = ''

  showLoading(true)
  showError(null)

  const [quoteResult, histResult] = await Promise.all([
    window.stockApi.getQuote(symbol),
    (async () => {
      const period2 = new Date()
      const period1 = new Date()
      period1.setFullYear(period1.getFullYear() - 1)
      return window.stockApi.getHistorical(
        symbol,
        period1.toISOString().slice(0, 10),
        period2.toISOString().slice(0, 10)
      )
    })()
  ])

  showLoading(false)

  if (!quoteResult.ok) {
    showError(quoteResult.error || 'Failed to load quote')
    quoteName.textContent = 'Failed to load'
    return
  }

  const q = quoteResult.data
  quoteName.textContent = q.shortName || q.longName || symbol

  currentIsEtf = String(q.quoteType || '').toUpperCase() === 'ETF'
  updateDetailTabsForEtf()

  const price = q.regularMarketPrice ?? q.price
  quotePrice.textContent = price != null ? formatPrice(price) : '—'

  const change = q.regularMarketChange
  const changePercent = q.regularMarketChangePercent
  quoteChange.innerHTML = ''

  if (change != null || changePercent != null) {
    const changeEl = document.createElement('span')
    const base = change ?? changePercent
    const positive = Number(base) >= 0
    changeEl.className = 'change ' + (positive ? 'positive' : 'negative')

    let text = ''
    if (change != null) {
      text += (positive ? '+' : '') + formatPrice(change)
    }
    if (changePercent != null) {
      text +=
        ' (' +
        (Number(changePercent) >= 0 ? '+' : '') +
        Number(changePercent).toFixed(2) +
        '%)'
    }
    changeEl.textContent = text
    quoteChange.appendChild(changeEl)
  }

  const metaFields = [
    ['Market Cap', q.marketCap],
    ['Volume', q.regularMarketVolume],
    ['Day High', q.regularMarketDayHigh],
    ['Day Low', q.regularMarketDayLow],
    ['52w High', q.fiftyTwoWeekHigh],
    ['52w Low', q.fiftyTwoWeekLow]
  ]

  quoteMeta.innerHTML = metaFields
    .map(
      ([label, val]) =>
        `<div class="meta-item">
           <span class="meta-label">${escapeHtml(label)}</span>
           ${formatNum(val)}
         </div>`
    )
    .join('')

  if (histResult.ok && Array.isArray(histResult.data) && histResult.data.length > 0) {
    const rows = histResult.data.slice(-30).reverse()
    historyBody.innerHTML = rows
      .map(
        (r) => `
          <tr>
            <td>${formatDate(r.date)}</td>
            <td>${formatPrice(r.open)}</td>
            <td>${formatPrice(r.high)}</td>
            <td>${formatPrice(r.low)}</td>
            <td>${formatPrice(r.close)}</td>
            <td>${formatNum(r.volume)}</td>
          </tr>
        `
      )
      .join('')
    renderHistoryChart(histResult.data)
  } else {
    historyBody.innerHTML = '<tr><td colspan="6">No history available</td></tr>'
    renderHistoryChart([])
  }
}

window.addEventListener('resize', () => {
  if (historyChartInstance) {
    historyChartInstance.resize()
  }
})

// Initialize theme on load
applyThemeFromStorage()

function renderFinancials (data) {
  const income = (data.incomeAnnual || []).slice(0, 4)
  const balance = (data.balanceAnnual || []).slice(0, 4)

  if (income.length === 0 && balance.length === 0) {
    financialsStatus.textContent = 'Financials unavailable'
    return
  }

  financialsStatus.textContent = 'Showing last 4 annual periods.'

  if (income.length > 0) {
    const periods = income.map(r => formatDate(r.endDate || r.date))
    incomeHead.innerHTML =
      '<tr><th>Line Item</th>' +
      periods.map(p => `<th>${p}</th>`).join('') +
      '</tr>'

    const fields = [
      ['Total Revenue', 'totalRevenue'],
      ['Gross Profit', 'grossProfit'],
      ['Operating Income', 'operatingIncome'],
      ['Net Income', 'netIncome']
    ]

    incomeBody.innerHTML = fields
      .map(([label, key]) => {
        const cells = income
          .map(r => `<td>${formatNum(r[key])}</td>`)
          .join('')
        return `<tr><td>${escapeHtml(label)}</td>${cells}</tr>`
      })
      .join('')
  }

  if (balance.length > 0) {
    const periods = balance.map(r => formatDate(r.endDate || r.date))
    balanceHead.innerHTML =
      '<tr><th>Line Item</th>' +
      periods.map(p => `<th>${p}</th>`).join('') +
      '</tr>'

    const fields = [
      ['Total Assets', 'totalAssets'],
      ['Total Liabilities', 'totalLiab'],
      ['Total Equity', 'totalStockholderEquity']
    ]

    balanceBody.innerHTML = fields
      .map(([label, key]) => {
        const cells = balance
          .map(r => `<td>${formatNum(r[key])}</td>`)
          .join('')
        return `<tr><td>${escapeHtml(label)}</td>${cells}</tr>`
      })
      .join('')
  }
}

// Wire up events
searchBtn.addEventListener('click', doSearch)
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch()
})

// Quick tiles: click to set search box and load that symbol
quickTiles.forEach((tile) => {
  tile.addEventListener('click', () => {
    const symbol = tile.getAttribute('data-symbol')
    if (!symbol) return
    searchInput.value = symbol
    // Go straight to that symbol's quote (faster than searching and picking)
    selectSymbol(symbol)
  })
})

// ETF tiles: same behavior, separate group for clarity
etfTiles.forEach((tile) => {
  tile.addEventListener('click', () => {
    const symbol = tile.getAttribute('data-symbol')
    if (!symbol) return
    searchInput.value = symbol
    selectSymbol(symbol)
  })
})

function updateDetailTabsForEtf () {
  if (!tabFinancials || !tabEdgar || !tabEtf) return
  if (currentIsEtf) {
    tabFinancials.classList.add('hidden')
    tabEdgar.classList.add('hidden')
    tabEtf.classList.remove('hidden')
    if (financialsPanel) financialsPanel.classList.add('hidden')
    if (edgarPanel) edgarPanel.classList.add('hidden')
    if (etfPanel) etfPanel.classList.add('hidden')
    quotePanel.classList.remove('hidden')
    tabQuote.classList.add('active')
    tabFinancials.classList.remove('active')
    tabEdgar.classList.remove('active')
    tabEtf.classList.remove('active')
  } else {
    tabFinancials.classList.remove('hidden')
    tabEdgar.classList.remove('hidden')
    tabEtf.classList.add('hidden')
    if (etfPanel) etfPanel.classList.add('hidden')
  }
}

tabQuote.addEventListener('click', () => {
  tabQuote.classList.add('active')
  tabFinancials.classList.remove('active')
  if (tabEdgar) tabEdgar.classList.remove('active')
  if (tabEtf) tabEtf.classList.remove('active')
  quotePanel.classList.remove('hidden')
  financialsPanel.classList.add('hidden')
  if (edgarPanel) edgarPanel.classList.add('hidden')
  if (etfPanel) etfPanel.classList.add('hidden')
})

tabFinancials.addEventListener('click', () => {
  tabFinancials.classList.add('active')
  tabQuote.classList.remove('active')
  if (tabEdgar) tabEdgar.classList.remove('active')
  if (tabEtf) tabEtf.classList.remove('active')
  quotePanel.classList.add('hidden')
  financialsPanel.classList.remove('hidden')
  if (edgarPanel) edgarPanel.classList.add('hidden')
  if (etfPanel) etfPanel.classList.add('hidden')

  if (!currentSymbol) {
    financialsStatus.textContent = 'Select a symbol to view financials.'
    return
  }

  if (financialsLoadedFor === currentSymbol) {
    return
  }

  ;(async () => {
    financialsStatus.textContent = 'Loading financials…'
    incomeHead.innerHTML = ''
    incomeBody.innerHTML = ''
    balanceHead.innerHTML = ''
    balanceBody.innerHTML = ''
    try {
      const finResult = await window.stockApi.getFinancials(currentSymbol)
      if (finResult.ok && finResult.data) {
        renderFinancials(finResult.data)
        financialsLoadedFor = currentSymbol
      } else {
        financialsStatus.textContent = finResult.error || 'Financials unavailable'
      }
    } catch (err) {
      financialsStatus.textContent = 'Financials unavailable'
    }
  })()
})

subtabIncome.addEventListener('click', () => {
  subtabIncome.classList.add('active')
  subtabBalance.classList.remove('active')
  incomeTableWrap.classList.remove('hidden')
  balanceTableWrap.classList.add('hidden')
})

subtabBalance.addEventListener('click', () => {
  subtabBalance.classList.add('active')
  subtabIncome.classList.remove('active')
  balanceTableWrap.classList.remove('hidden')
  incomeTableWrap.classList.add('hidden')
})

// --- ETF tab ---
if (tabEtf) {
  tabEtf.addEventListener('click', () => {
    tabEtf.classList.add('active')
    tabQuote.classList.remove('active')
    if (tabFinancials) tabFinancials.classList.remove('active')
    if (tabEdgar) tabEdgar.classList.remove('active')
    quotePanel.classList.add('hidden')
    if (financialsPanel) financialsPanel.classList.add('hidden')
    if (edgarPanel) edgarPanel.classList.add('hidden')
    if (etfPanel) etfPanel.classList.remove('hidden')

    if (!currentSymbol) {
      etfStatus.textContent = 'Select an ETF to view details.'
      etfStatus.classList.remove('hidden')
      return
    }

    if (etfDetailsLoadedFor === currentSymbol) return

    ;(async () => {
      etfStatus.textContent = 'Loading ETF data…'
      etfStatus.classList.remove('hidden')
      etfExpenseSection.classList.add('hidden')
      etfHoldingsSection.classList.add('hidden')
      etfComingSoon.classList.add('hidden')
      try {
        const res = await window.stockApi.getEtfDetails(currentSymbol)
        if (res.ok && res.data) {
          renderEtfDetails(res.data)
          etfDetailsLoadedFor = currentSymbol
        } else {
          etfStatus.textContent = res.error || 'ETF data unavailable.'
          etfComingSoon.classList.remove('hidden')
          etfComingSoon.querySelector('p').textContent = 'More ETF data coming soon.'
        }
      } catch (err) {
        etfStatus.textContent = 'ETF data unavailable.'
        etfComingSoon.classList.remove('hidden')
      }
    })()
  })
}

function renderEtfDetails (data) {
  etfStatus.classList.add('hidden')
  let hasAny = false

  const expenseRatio =
    data.fundProfile?.feesExpensesInvestment?.netExpRatio ??
    data.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio ??
    data.fundProfile?.feesExpensesInvestment?.grossExpRatio

  if (expenseRatio != null && Number.isFinite(expenseRatio)) {
    const pct = (Number(expenseRatio) * 100).toFixed(2)
    etfExpenseValue.textContent = pct + '%'
    etfExpenseSection.classList.remove('hidden')
    hasAny = true
  } else {
    etfExpenseSection.classList.add('hidden')
  }

  const holdings = data.topHoldings?.holdings
  if (Array.isArray(holdings) && holdings.length > 0) {
    etfHoldingsList.innerHTML = holdings
      .slice(0, 15)
      .map(
        (h) =>
          `<div class="etf-holding"><span class="etf-holding-symbol">${escapeHtml(h.symbol || '')}</span> ${escapeHtml(h.holdingName || '')} <span class="etf-holding-pct">${(Number(h.holdingPercent) * 100).toFixed(2)}%</span></div>`
      )
      .join('')
    etfHoldingsSection.classList.remove('hidden')
    hasAny = true
  } else {
    etfHoldingsSection.classList.add('hidden')
  }

  if (!hasAny) {
    etfComingSoon.classList.remove('hidden')
    etfComingSoon.querySelector('p').textContent = 'More ETF data coming soon.'
  } else {
    etfComingSoon.classList.add('hidden')
  }
}

// --- SEC EDGAR ---
if (tabEdgar) {
  tabEdgar.addEventListener('click', () => {
    tabEdgar.classList.add('active')
    tabQuote.classList.remove('active')
    tabFinancials.classList.remove('active')
    if (tabEtf) tabEtf.classList.remove('active')
    quotePanel.classList.add('hidden')
    financialsPanel.classList.add('hidden')
    edgarPanel.classList.remove('hidden')
    if (etfPanel) etfPanel.classList.add('hidden')

    // If a stock is already selected, automatically show its SEC filings
    if (currentSymbol && window.edgar) {
      if (edgarSearchBar) edgarSearchBar.classList.add('hidden')
      ;(async () => {
        try {
          await openEdgarForSymbol(currentSymbol)
        } catch (err) {
          showError(err.message || 'Failed to load SEC filings')
        }
      })()
    } else if (edgarSearchBar) {
      // No symbol selected – show EDGAR search controls
      edgarSearchBar.classList.remove('hidden')
    }
  })
}

async function openEdgarForSymbol (symbol) {
  const query = String(symbol || '').trim()
  if (!query || !window.edgar) return

  edgarHint.classList.add('hidden')
  edgarCompanyList.classList.add('hidden')
  edgarCompanyList.innerHTML = ''
  edgarSelectedCompany.classList.add('hidden')
  edgarFilingsWrap.classList.add('hidden')
  edgarFilingsBody.innerHTML = ''
  edgarFilingsHint.classList.remove('hidden')
  edgarFilingsHint.textContent = 'Searching EDGAR…'
  showLoading(true)
  showError(null)

  const result = await window.edgar.searchCompany(query)
  showLoading(false)

  if (!result.ok) {
    showError(result.error || 'EDGAR search failed')
    edgarFilingsHint.textContent = result.error || 'Search failed.'
    return
  }

  const companies = result.data || []
  if (companies.length === 0) {
    edgarFilingsHint.textContent =
      'No SEC registrant found for this ticker. Try using the company name instead.'
    return
  }

  // Prefer an exact ticker match, fall back to the first result
  const upper = query.toUpperCase()
  const exact =
    companies.find(
      (c) => String(c.ticker || '').toUpperCase() === upper
    ) || companies[0]

  selectEdgarCompany(exact)
}

async function doEdgarSearch () {
  const query = edgarSearchInput ? edgarSearchInput.value.trim() : ''
  if (!query || !window.edgar) return

  edgarHint.classList.add('hidden')
  edgarCompanyList.classList.add('hidden')
  edgarCompanyList.innerHTML = ''
  edgarSelectedCompany.classList.add('hidden')
  edgarFilingsWrap.classList.add('hidden')
  edgarFilingsBody.innerHTML = ''
  edgarFilingsHint.classList.remove('hidden')
  edgarFilingsHint.textContent = 'Searching EDGAR…'
  showLoading(true)
  showError(null)

  const result = await window.edgar.searchCompany(query)
  showLoading(false)

  if (!result.ok) {
    showError(result.error || 'EDGAR search failed')
    edgarFilingsHint.textContent = result.error || 'Search failed.'
    return
  }

  const companies = result.data || []
  if (companies.length === 0) {
    edgarFilingsHint.textContent = 'No companies found. Try a different ticker or name.'
    return
  }

  edgarFilingsHint.classList.add('hidden')
  if (companies.length === 1) {
    selectEdgarCompany(companies[0])
    return
  }

  edgarCompanyList.classList.remove('hidden')
  companies.slice(0, 15).forEach((company) => {
    const div = document.createElement('div')
    div.className = 'edgar-company-item'
    div.innerHTML = `<span class="symbol">${escapeHtml(company.ticker || '')}</span> ${escapeHtml(company.name || '')}`
    div.addEventListener('click', () => selectEdgarCompany(company))
    edgarCompanyList.appendChild(div)
  })
}

function getEdgarFormFilter () {
  if (!edgarFormFilter) return []
  const val = edgarFormFilter.value || ''
  if (!val.trim()) return []
  return val.split(',').map((s) => s.trim()).filter(Boolean)
}

async function selectEdgarCompany (company) {
  currentEdgarCompany = company
  edgarCompanyList.classList.add('hidden')
  edgarCompanyList.innerHTML = ''
  edgarSelectedCompany.classList.remove('hidden')
  edgarSelectedCompany.textContent = `Company: ${company.ticker || ''} – ${company.name || ''} (CIK: ${company.cik || ''})`
  edgarFilingsWrap.classList.add('hidden')
  edgarFilingsBody.innerHTML = ''
  edgarFilingsHint.classList.remove('hidden')
  edgarFilingsHint.textContent = 'Loading filings…'
  showLoading(true)
  showError(null)

  const forms = getEdgarFormFilter()
  const result = await window.edgar.getFilings({ cik: company.cik, forms })
  showLoading(false)

  if (!result.ok) {
    showError(result.error || 'Failed to load filings')
    edgarFilingsHint.textContent = result.error || 'Failed to load filings.'
    return
  }

  edgarFilings = result.data || []
  edgarFilingsHint.classList.add('hidden')
  if (edgarFilings.length === 0) {
    edgarFilingsHint.classList.remove('hidden')
    edgarFilingsHint.textContent = 'No filings found for this company.'
    return
  }

  edgarFilingsWrap.classList.remove('hidden')
  edgarFilingsBody.innerHTML = edgarFilings
    .map(
      (f) => `
        <tr>
          <td>${formatDate(f.filingDate)}</td>
          <td>${escapeHtml(f.form || '')}</td>
          <td>${formatDate(f.reportDate)}</td>
          <td>${escapeHtml(f.description || '')}</td>
          <td>
            <div class="edgar-action-btns">
              <button type="button" class="edgar-btn download-pdf" data-accession="${escapeHtml(f.accessionNumber)}" data-cik="${escapeHtml(f.cik)}" data-primary="${escapeHtml(f.primaryDocument || '')}">Download</button>
              <button type="button" class="edgar-btn open" data-accession="${escapeHtml(f.accessionNumber)}" data-cik="${escapeHtml(f.cik)}" data-primary="${escapeHtml(f.primaryDocument || '')}">View Report</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('')

  edgarFilingsBody.querySelectorAll('.download-pdf').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cik = btn.getAttribute('data-cik')
      const accessionNumber = btn.getAttribute('data-accession')
      const primaryDocument = btn.getAttribute('data-primary') || undefined
      if (!cik || !accessionNumber) return
      btn.disabled = true
      btn.textContent = 'Downloading…'
      showError(null)
      try {
        const res = await window.edgar.downloadPdf({ cik, accessionNumber, primaryDocument })
        if (res.ok) {
          const openBtn = btn.nextElementSibling
          if (openBtn) {
            openBtn.dataset.path = res.path
          }
          btn.remove()
        } else {
          showError(res.error || 'Download failed')
          btn.textContent = 'Download'
          btn.disabled = false
        }
      } catch (err) {
        showError(err.message || 'Download failed')
        btn.textContent = 'Download'
        btn.disabled = false
      }
    })
  })

  edgarFilingsBody.querySelectorAll('.edgar-btn.open').forEach((btn) => {
    btn.addEventListener('click', async () => {
      let path = btn.dataset.path
      const cik = btn.getAttribute('data-cik')
      const accessionNumber = btn.getAttribute('data-accession')
      const primaryDocument = btn.getAttribute('data-primary') || undefined
      if (!path && cik && accessionNumber) {
        btn.disabled = true
        btn.textContent = 'Preparing…'
        try {
          const res = await window.edgar.downloadPdf({ cik, accessionNumber, primaryDocument })
          if (res.ok) {
            path = res.path
            btn.dataset.path = res.path
          }
        } catch (_) {}
        btn.disabled = false
        btn.textContent = 'View Report'
      }
      if (path && window.edgar.openPdf) window.edgar.openPdf(path)
    })
  })
}

if (edgarSearchBtn) {
  edgarSearchBtn.addEventListener('click', doEdgarSearch)
}
if (edgarSearchInput) {
  edgarSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doEdgarSearch()
  })
}
if (edgarFormFilter) {
  edgarFormFilter.addEventListener('change', () => {
    if (currentEdgarCompany) selectEdgarCompany(currentEdgarCompany)
  })
}


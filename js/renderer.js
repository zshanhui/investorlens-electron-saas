/**
 * Main renderer: search, quote, financials, ETF, tabs, init.
 */
;(function () {
  const App = window.App

  function updateThemeToggleLabel () {
  if (!App.dom.themeToggle) return
  const isLight = document.body.classList.contains('light-theme')
  App.dom.themeToggle.textContent = App.t(isLight ? 'theme.dark' : 'theme.light')
}

function applyThemeFromStorage () {
  try {
    const saved = window.localStorage.getItem('theme')
    if (saved === 'light') document.body.classList.add('light-theme')
    else if (saved === 'dark') document.body.classList.remove('light-theme')
  } catch (_) {}
  updateThemeToggleLabel()
}

if (App.dom.themeToggle) {
  App.dom.themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme')
    try {
      window.localStorage.setItem('theme', isLight ? 'light' : 'dark')
    } catch (_) {}
    updateThemeToggleLabel()
    if (App.state.historyChartInstance) App.state.historyChartInstance.resize()
  })
}

window.addEventListener('resize', () => {
  if (App.state.historyChartInstance) App.state.historyChartInstance.resize()
})

function updateDetailTabsForEtf () {
  if (!App.dom.tabFinancials || !App.dom.tabEdgar || !App.dom.tabEtf) return
  if (App.state.currentIsEtf) {
    App.dom.tabFinancials.classList.add('hidden')
    App.dom.tabEdgar.classList.add('hidden')
    App.dom.tabEtf.classList.remove('hidden')
    if (App.dom.financialsPanel) App.dom.financialsPanel.classList.add('hidden')
    if (App.dom.edgarPanel) App.dom.edgarPanel.classList.add('hidden')
    if (App.dom.etfPanel) App.dom.etfPanel.classList.add('hidden')
    App.dom.quotePanel.classList.remove('hidden')
    App.dom.tabQuote.classList.add('active')
    App.dom.tabFinancials.classList.remove('active')
    App.dom.tabEdgar.classList.remove('active')
  } else {
    App.dom.tabFinancials.classList.remove('hidden')
    App.dom.tabEdgar.classList.remove('hidden')
    App.dom.tabEtf.classList.add('hidden')
    if (App.dom.etfPanel) App.dom.etfPanel.classList.add('hidden')
  }
}

function normalizeSearchItem (item) {
  if (!item || typeof item !== 'object') return null
  const symbol = item.symbol || item.ticker || ''
  if (!symbol) return null

  const type = item.quoteType || item.type || item.assetType || ''
  const name = item.shortname || item.longname || item.name || item.companyName || ''

  return { symbol, type, name }
}

function isProbablyEtfQuote (q) {
  if (!q || typeof q !== 'object') return false
  if (String(q.quoteType || '').toUpperCase() === 'ETF') return true
  const name = String(q.shortName || q.longName || q.name || '').toUpperCase()
  if (name.includes('ETF')) return true
  return false
}

function pickQuoteNumber (q, keys) {
  for (const key of keys) {
    const val = q[key]
    if (val != null && val !== '') {
      const n = Number(val)
      if (!Number.isNaN(n)) return n
    }
  }
  return null
}

function renderQuoteLastUpdated (result) {
  if (!App.dom.quoteUpdated) return
  const ts = result && result.lastUpdated
  if (!ts) {
    App.dom.quoteUpdated.textContent = ''
    return
  }
  const t = new Date(ts)
  if (Number.isNaN(t.getTime())) {
    App.dom.quoteUpdated.textContent = ''
    return
  }
  let diff = Math.floor((Date.now() - t.getTime()) / 1000)
  if (!Number.isFinite(diff)) {
    App.dom.quoteUpdated.textContent = ''
    return
  }
  if (diff < 0) diff = 0
  if (diff > 60) diff = 60
  App.dom.quoteUpdated.textContent = ` (Updated ${diff}s ago)`
}

async function doSearch () {
  const query = App.dom.searchInput.value.trim()
  if (!query) return

  App.dom.resultsList.innerHTML = ''
  App.dom.resultsHint.classList.add('hidden')
  App.utils.showLoading(true)
  App.utils.showError(null)

  const result = await window.stockApi.search(query)
  App.utils.showLoading(false)

  if (!result.ok) {
    App.utils.showError(App.utils.translateError(result.error) || App.t('error.searchFailed'))
    App.dom.resultsHint.textContent = App.t('results.searchFailed')
    App.dom.resultsHint.classList.remove('hidden')
    return
  }

  const rawItems = Array.isArray(result.data) ? result.data : (result.data?.quotes || [])
  const items = rawItems
    .map(normalizeSearchItem)
    .filter(Boolean)
  if (!items || items.length === 0) {
    App.dom.resultsHint.textContent = App.t('results.noResults')
    App.dom.resultsHint.classList.remove('hidden')
    return
  }

  App.dom.resultsHint.classList.add('hidden')
  items.forEach((item) => {
    const div = document.createElement('div')
    div.className = 'result-item'
    div.innerHTML = `
      <span class="symbol">${App.utils.escapeHtml(item.symbol || '')}</span>
      <span class="type">${App.utils.escapeHtml(item.type || '')}</span>
      <span class="name">${App.utils.escapeHtml(item.name || '')}</span>
    `
    div.addEventListener('click', () => selectSymbol(item.symbol))
    App.dom.resultsList.appendChild(div)
  })
}

async function selectSymbol (symbol) {
  if (!symbol) return

  // Remember which detail panel is currently active so we can preserve it
  if (App.dom.quotePanel && App.dom.financialsPanel && App.dom.edgarPanel && App.dom.etfPanel) {
    if (!App.dom.quotePanel.classList.contains('hidden')) {
      App.state.currentDetailPanel = 'quote'
    } else if (!App.dom.financialsPanel.classList.contains('hidden')) {
      App.state.currentDetailPanel = 'financials'
    } else if (!App.dom.edgarPanel.classList.contains('hidden')) {
      App.state.currentDetailPanel = 'edgar'
    } else if (!App.dom.etfPanel.classList.contains('hidden')) {
      App.state.currentDetailPanel = 'etf'
    }
  }

  App.state.currentSymbol = symbol
  App.state.financialsLoadedFor = null
  App.state.etfDetailsLoadedFor = null

  App.dom.detailHint.classList.add('hidden')
  App.dom.quoteSymbol.textContent = symbol
  App.dom.quoteName.textContent = App.t('quote.loading')
  App.dom.quotePrice.textContent = '—'
  App.dom.quoteChange.textContent = ''
  if (App.dom.quoteUpdated) App.dom.quoteUpdated.textContent = ''
  if (App.dom.quoteValuation) App.dom.quoteValuation.innerHTML = ''
  if (App.dom.quoteMovement) App.dom.quoteMovement.innerHTML = ''
  App.dom.historyBody.innerHTML = ''
  if (App.dom.historyChart) App.dom.historyChart.innerHTML = ''
  App.dom.financialsStatus.textContent = App.t('quote.clickFinancials')
  App.dom.incomeHead.innerHTML = ''
  App.dom.incomeBody.innerHTML = ''
  App.dom.balanceHead.innerHTML = ''
  App.dom.balanceBody.innerHTML = ''

  App.utils.showLoading(true)
  App.utils.showError(null)

  const period2 = new Date()
  const period1 = new Date()
  period1.setFullYear(period1.getFullYear() - 1)

  const [quoteResult, histResult] = await Promise.all([
    window.stockApi.getQuote(symbol),
    window.stockApi.getHistorical(symbol, period1.toISOString().slice(0, 10), period2.toISOString().slice(0, 10))
  ])

  App.utils.showLoading(false)

  if (!quoteResult.ok) {
    App.utils.showError(App.utils.translateError(quoteResult.error) || App.t('error.loadQuoteFailed'))
    App.dom.quoteName.textContent = App.t('quote.failedToLoad')
    if (App.dom.quoteUpdated) App.dom.quoteUpdated.textContent = ''
    return
  }

  const q = quoteResult.data || {}
  App.dom.quoteName.textContent = q.shortName || q.longName || q.name || symbol

  App.state.currentIsEtf = isProbablyEtfQuote(q)
  updateDetailTabsForEtf()

  const price = pickQuoteNumber(q, ['regularMarketPrice', 'price'])
  App.dom.quotePrice.textContent = price != null ? App.utils.formatPrice(price) : '—'

  const change = pickQuoteNumber(q, ['regularMarketChange', 'change'])
  const changePercent = pickQuoteNumber(q, ['regularMarketChangePercent', 'changesPercentage'])
  App.dom.quoteChange.innerHTML = ''

  if (change != null || changePercent != null) {
    const changeEl = document.createElement('span')
    const base = change ?? changePercent
    const positive = Number(base) >= 0
    changeEl.className = 'change ' + (positive ? 'positive' : 'negative')
    let text = ''
    if (change != null) text += (positive ? '+' : '') + App.utils.formatPrice(change)
    if (changePercent != null) text += ' (' + (Number(changePercent) >= 0 ? '+' : '') + Number(changePercent).toFixed(2) + '%)'
    changeEl.textContent = text
    App.dom.quoteChange.appendChild(changeEl)
  }

  const valuationFields = [
    [App.t('quote.marketCap'), pickQuoteNumber(q, ['marketCap']), App.utils.formatNum],
    [App.t('quote.peTtm'), pickQuoteNumber(q, ['trailingPE', 'pe']), App.utils.formatRatio],
    [App.t('quote.forwardPe'), pickQuoteNumber(q, ['forwardPE', 'forwardPe']), App.utils.formatRatio],
    [App.t('quote.pb'), pickQuoteNumber(q, ['priceToBook']), App.utils.formatRatio],
    [App.t('quote.psTtm'), pickQuoteNumber(q, ['priceToSalesTrailing12Months', 'priceToSalesTTM']), App.utils.formatRatio]
  ]
  App.dom.quoteValuation.innerHTML = valuationFields
    .map(([label, val, fmt]) => `<div class="meta-item"><span class="meta-label">${App.utils.escapeHtml(label)}</span> ${(fmt || App.utils.formatNum)(val)}</div>`)
    .join('')

  const movementFields = [
    [App.t('quote.volume'), pickQuoteNumber(q, ['regularMarketVolume', 'volume']), App.utils.formatNum],
    [App.t('quote.dayHigh'), pickQuoteNumber(q, ['regularMarketDayHigh', 'dayHigh']), App.utils.formatPrice],
    [App.t('quote.dayLow'), pickQuoteNumber(q, ['regularMarketDayLow', 'dayLow']), App.utils.formatPrice],
    [App.t('quote.w52High'), pickQuoteNumber(q, ['fiftyTwoWeekHigh', 'yearHigh']), App.utils.formatPrice],
    [App.t('quote.w52Low'), pickQuoteNumber(q, ['fiftyTwoWeekLow', 'yearLow']), App.utils.formatPrice]
  ]
  App.dom.quoteMovement.innerHTML = movementFields
    .map(([label, val, fmt]) => `<div class="meta-item"><span class="meta-label">${App.utils.escapeHtml(label)}</span> ${(fmt || App.utils.formatNum)(val)}</div>`)
    .join('')

  renderQuoteLastUpdated(quoteResult)

  if (histResult.ok && Array.isArray(histResult.data) && histResult.data.length > 0) {
    const rows = histResult.data.slice(-30).reverse()
    App.dom.historyBody.innerHTML = rows
      .map((r) => `<tr><td>${App.utils.formatDate(r.date)}</td><td>${App.utils.formatPrice(r.open)}</td><td>${App.utils.formatPrice(r.high)}</td><td>${App.utils.formatPrice(r.low)}</td><td>${App.utils.formatPrice(r.close)}</td><td>${App.utils.formatNum(r.volume)}</td></tr>`)
      .join('')
    App.renderHistoryChart(histResult.data)
  } else {
    App.dom.historyBody.innerHTML = '<tr><td colspan="6">' + App.t('history.noHistory') + '</td></tr>'
    App.renderHistoryChart([])
  }

  if (App.alerts && typeof App.alerts.refreshForCurrentSymbol === 'function') {
    App.alerts.refreshForCurrentSymbol()
  }

  // After quote has loaded, restore the previously active detail panel if it is valid
  if (App.state.currentDetailPanel === 'financials') {
    // For ETFs, financials are hidden; fall back to quote
    if (!App.state.currentIsEtf) {
      showPanel('financials')
      // Trigger lazy load for new symbol if needed
      if (App.dom.tabFinancials) {
        App.dom.tabFinancials.click()
      }
    } else {
      showPanel('quote')
    }
  } else if (App.state.currentDetailPanel === 'edgar') {
    if (!App.state.currentIsEtf && App.dom.tabEdgar) {
      App.dom.tabEdgar.click()
    } else {
      showPanel('quote')
    }
  } else if (App.state.currentDetailPanel === 'etf') {
    if (App.state.currentIsEtf && App.dom.tabEtf) {
      App.dom.tabEtf.click()
    } else {
      showPanel('quote')
    }
  } else {
    showPanel('quote')
  }
}

function renderFinancials (data) {
  const income = (data.incomeAnnual || []).slice(0, 4)
  const balance = (data.balanceAnnual || []).slice(0, 4)

  if (income.length === 0 && balance.length === 0) {
    App.dom.financialsStatus.textContent = App.t('financials.unavailable')
    return
  }

  App.dom.financialsStatus.textContent = App.t('financials.showingPeriods')

  if (income.length > 0) {
    const periods = income.map(r => App.utils.formatDate(r.endDate || r.date))
    App.dom.incomeHead.innerHTML = '<tr><th>' + App.t('financials.lineItem') + '</th>' + periods.map(p => `<th>${p}</th>`).join('') + '</tr>'
    const fields = [
      [App.t('financials.totalRevenue'), 'totalRevenue'],
      [App.t('financials.grossProfit'), 'grossProfit'],
      [App.t('financials.operatingIncome'), 'operatingIncome'],
      [App.t('financials.netIncome'), 'netIncome']
    ]
    App.dom.incomeBody.innerHTML = fields
      .map(([label, key]) => {
        const cells = income.map(r => `<td>${App.utils.formatNum(r[key])}</td>`).join('')
        return `<tr><td>${App.utils.escapeHtml(label)}</td>${cells}</tr>`
      })
      .join('')
  }

  if (balance.length > 0) {
    const periods = balance.map(r => App.utils.formatDate(r.endDate || r.date))
    App.dom.balanceHead.innerHTML = '<tr><th>' + App.t('financials.lineItem') + '</th>' + periods.map(p => `<th>${p}</th>`).join('') + '</tr>'
    const fields = [
      [App.t('financials.totalAssets'), 'totalAssets'],
      [App.t('financials.totalLiabilities'), 'totalLiab'],
      [App.t('financials.totalEquity'), 'totalStockholderEquity']
    ]
    App.dom.balanceBody.innerHTML = fields
      .map(([label, key]) => {
        const cells = balance.map(r => `<td>${App.utils.formatNum(r[key])}</td>`).join('')
        return `<tr><td>${App.utils.escapeHtml(label)}</td>${cells}</tr>`
      })
      .join('')
  }
}

function renderEtfDetails (data) {
  App.dom.etfStatus.classList.add('hidden')
  let hasAny = false

  const expenseRatio =
    data.fundProfile?.feesExpensesInvestment?.netExpRatio ??
    data.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio ??
    data.fundProfile?.feesExpensesInvestment?.grossExpRatio

  if (expenseRatio != null && Number.isFinite(expenseRatio)) {
    App.dom.etfExpenseValue.textContent = (Number(expenseRatio) * 100).toFixed(2) + '%'
    App.dom.etfExpenseSection.classList.remove('hidden')
    hasAny = true
  } else {
    App.dom.etfExpenseSection.classList.add('hidden')
  }

  const holdings = data.topHoldings?.holdings
  if (Array.isArray(holdings) && holdings.length > 0) {
    App.dom.etfHoldingsList.innerHTML = holdings
      .slice(0, 15)
      .map((h) => `<div class="etf-holding"><span class="etf-holding-symbol">${App.utils.escapeHtml(h.symbol || '')}</span> ${App.utils.escapeHtml(h.holdingName || '')} <span class="etf-holding-pct">${(Number(h.holdingPercent) * 100).toFixed(2)}%</span></div>`)
      .join('')
    App.dom.etfHoldingsSection.classList.remove('hidden')
    hasAny = true
  } else {
    App.dom.etfHoldingsSection.classList.add('hidden')
  }

  if (!hasAny) {
    App.dom.etfComingSoon.classList.remove('hidden')
    App.dom.etfComingSoon.querySelector('p').textContent = App.t('etf.comingSoon')
  } else {
    App.dom.etfComingSoon.classList.add('hidden')
  }
}

function showPanel (panel) {
  const isQuote = panel === 'quote'
  const isFinancials = panel === 'financials'
  const isEdgar = panel === 'edgar'
  const isEtf = panel === 'etf'

  if (App.dom.alertsScreen) {
    App.dom.alertsScreen.classList.add('hidden')
  }
  if (App.dom.detailTabs) {
    App.dom.detailTabs.classList.remove('hidden')
  }

  App.dom.quotePanel.classList.toggle('hidden', !isQuote)
  App.dom.financialsPanel.classList.toggle('hidden', !isFinancials)
  if (App.dom.edgarPanel) App.dom.edgarPanel.classList.toggle('hidden', !isEdgar)
  if (App.dom.etfPanel) App.dom.etfPanel.classList.toggle('hidden', !isEtf)
  App.dom.tabQuote.classList.toggle('active', isQuote)
  App.dom.tabFinancials.classList.toggle('active', isFinancials)
  if (App.dom.tabEdgar) App.dom.tabEdgar.classList.toggle('active', isEdgar)
  if (App.dom.tabEtf) App.dom.tabEtf.classList.toggle('active', isEtf)

  if (isQuote && App.state.historyChartInstance) {
    requestAnimationFrame(() => {
      App.state.historyChartInstance.resize()
    })
  }
}

App.dom.searchBtn.addEventListener('click', doSearch)
App.dom.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch() })

function handleQuickTileClick (e) {
  const tile = e.target.closest('.quick-tile, .etf-tile')
  if (!tile) return
  const symbol = tile.getAttribute('data-symbol')
  if (symbol) {
    App.dom.searchInput.value = symbol
    selectSymbol(symbol)
  }
}

if (App.dom.nasdaqQuickGrid) App.dom.nasdaqQuickGrid.addEventListener('click', handleQuickTileClick)
if (App.dom.etfQuickGrid) App.dom.etfQuickGrid.addEventListener('click', handleQuickTileClick)

App.dom.tabQuote.addEventListener('click', () => showPanel('quote'))

App.dom.tabFinancials.addEventListener('click', () => {
  App.state.currentDetailPanel = 'financials'
  showPanel('financials')
  if (!App.state.currentSymbol) {
    App.dom.financialsStatus.textContent = App.t('financials.selectHint')
    return
  }
  if (App.state.financialsLoadedFor === App.state.currentSymbol) return

  ;(async () => {
    App.dom.financialsStatus.textContent = App.t('financials.loading')
    App.dom.incomeHead.innerHTML = ''
    App.dom.incomeBody.innerHTML = ''
    App.dom.balanceHead.innerHTML = ''
    App.dom.balanceBody.innerHTML = ''
    try {
      const finResult = await window.stockApi.getFinancials(App.state.currentSymbol)
      if (finResult.ok && finResult.data) {
        renderFinancials(finResult.data)
        App.state.financialsLoadedFor = App.state.currentSymbol
      } else {
        App.dom.financialsStatus.textContent = App.utils.translateError(finResult.error) || App.t('error.financialsFailed')
      }
    } catch (err) {
      App.dom.financialsStatus.textContent = App.t('error.financialsFailed')
    }
  })()
})

App.dom.subtabIncome.addEventListener('click', () => {
  App.dom.subtabIncome.classList.add('active')
  App.dom.subtabBalance.classList.remove('active')
  App.dom.incomeTableWrap.classList.remove('hidden')
  App.dom.balanceTableWrap.classList.add('hidden')
})

App.dom.subtabBalance.addEventListener('click', () => {
  App.dom.subtabBalance.classList.add('active')
  App.dom.subtabIncome.classList.remove('active')
  App.dom.balanceTableWrap.classList.remove('hidden')
  App.dom.incomeTableWrap.classList.add('hidden')
})

if (App.dom.tabEtf) {
  App.dom.tabEtf.addEventListener('click', () => {
    App.state.currentDetailPanel = 'etf'
    showPanel('etf')
    if (!App.state.currentSymbol) {
      App.dom.etfStatus.textContent = App.t('etf.selectHint')
      App.dom.etfStatus.classList.remove('hidden')
      return
    }
    if (App.state.etfDetailsLoadedFor === App.state.currentSymbol) return

    ;(async () => {
      App.dom.etfStatus.textContent = App.t('etf.loading')
      App.dom.etfStatus.classList.remove('hidden')
      App.dom.etfExpenseSection.classList.add('hidden')
      App.dom.etfHoldingsSection.classList.add('hidden')
      App.dom.etfComingSoon.classList.add('hidden')
      try {
        const res = await window.stockApi.getEtfDetails(App.state.currentSymbol)
        if (res.ok && res.data) {
          renderEtfDetails(res.data)
          App.state.etfDetailsLoadedFor = App.state.currentSymbol
        } else {
          App.dom.etfStatus.textContent = App.utils.translateError(res.error) || App.t('error.etfFailed')
          App.dom.etfComingSoon.classList.remove('hidden')
          App.dom.etfComingSoon.querySelector('p').textContent = App.t('etf.comingSoon')
        }
      } catch (err) {
        App.dom.etfStatus.textContent = App.t('error.etfFailed')
        App.dom.etfComingSoon.classList.remove('hidden')
      }
    })()
  })
}

if (App.dom.tabEdgar) {
  App.dom.tabEdgar.addEventListener('click', () => {
    App.state.currentDetailPanel = 'edgar'
    showPanel('edgar')
    if (App.state.currentSymbol && window.edgar) {
      if (App.dom.edgarSearchBar) App.dom.edgarSearchBar.classList.add('hidden')
      ;(async () => {
        try {
          await App.edgar.openEdgarForSymbol(App.state.currentSymbol)
        } catch (err) {
          App.utils.showError(App.utils.translateError(err.message) || App.t('error.secFilingsFailed'))
        }
      })()
    } else if (App.dom.edgarSearchBar) {
      App.dom.edgarSearchBar.classList.remove('hidden')
    }
  })
}

if (App.dom.openAlertsScreenBtn && App.dom.alertsScreen && App.dom.alertsBackBtn) {
  App.dom.openAlertsScreenBtn.addEventListener('click', () => {
    if (App.dom.detailTabs) App.dom.detailTabs.classList.add('hidden')
    App.dom.quotePanel.classList.add('hidden')
    App.dom.financialsPanel.classList.add('hidden')
    if (App.dom.edgarPanel) App.dom.edgarPanel.classList.add('hidden')
    if (App.dom.etfPanel) App.dom.etfPanel.classList.add('hidden')
    if (App.dom.alertsScreen) App.dom.alertsScreen.classList.remove('hidden')
    if (App.alerts && typeof App.alerts.refreshForCurrentSymbol === 'function') {
      App.alerts.refreshForCurrentSymbol()
    }
  })

  App.dom.alertsBackBtn.addEventListener('click', () => {
    if (App.dom.alertsScreen) App.dom.alertsScreen.classList.add('hidden')
    if (App.dom.detailTabs) App.dom.detailTabs.classList.remove('hidden')
    App.state.currentDetailPanel = 'quote'
    showPanel('quote')
  })
}

;(async function initApp () {
  const i18n = await window.__i18nInit()
  App.t = i18n.t
  i18n.applyToPage()
  if (App.dom.langSwitch) {
    App.dom.langSwitch.value = i18n.getLocale ? i18n.getLocale() : 'en'
    try {
      const stored = window.localStorage.getItem('i18n.locale')
      if (stored === 'zh' || stored === 'en') App.dom.langSwitch.value = stored
    } catch (_) {}
    App.dom.langSwitch.addEventListener('change', () => {
      const loc = App.dom.langSwitch.value
      if (loc !== 'en' && loc !== 'zh') return
      i18n.setLocale(loc)
      i18n.applyToPage()
      updateThemeToggleLabel()
      if (App.state.currentSymbol) selectSymbol(App.state.currentSymbol)
      if (App.state.currentEdgarCompany) App.edgar.selectEdgarCompany(App.state.currentEdgarCompany)
    })
  }
  applyThemeFromStorage()
  if (App.alerts && typeof App.alerts.init === 'function') {
    App.alerts.init()
  }
  App.dom.searchInput.value = 'NVDA'
  selectSymbol('NVDA')
})()
})()

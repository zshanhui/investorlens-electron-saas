/**
 * Quick tiles data and dynamic rendering.
 * Renders NASDAQ tech and ETF tiles from config.
 */
;(function () {
  const QUICK_TILES_NASDAQ = [
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'AVGO', name: 'Broadcom' },
    { symbol: 'AMD', name: 'AMD' },
    { symbol: 'NFLX', name: 'Netflix' }
  ]

  const QUICK_TILES_ETFS = [
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'VOO', name: 'Vanguard S&P 500' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market' },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF' }
  ]

  function renderQuickTiles (container, items, tileClass) {
    if (!container || !Array.isArray(items)) return
    container.innerHTML = items
      .map(
        (item) =>
          `<button class="${tileClass}" data-symbol="${escapeAttr(item.symbol)}">
            <span class="quick-symbol">${escapeHtml(item.symbol)}</span>
            <span class="quick-name">${escapeHtml(item.name)}</span>
          </button>`
      )
      .join('')
  }

  function escapeHtml (str) {
    if (str == null) return ''
    const s = String(str)
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function escapeAttr (str) {
    if (str == null) return ''
    return escapeHtml(String(str)).replace(/'/g, '&#39;')
  }

  function init () {
    const nasdaqGrid = document.getElementById('nasdaqQuickGrid')
    const etfGrid = document.getElementById('etfQuickGrid')
    if (nasdaqGrid) renderQuickTiles(nasdaqGrid, QUICK_TILES_NASDAQ, 'quick-tile')
    if (etfGrid) renderQuickTiles(etfGrid, QUICK_TILES_ETFS, 'etf-tile')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

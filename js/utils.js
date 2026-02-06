/**
 * Formatters and UI helpers.
 * Depends on App.dom, App.t (t set during init).
 */
;(function () {
  const App = window.App

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

function formatRatio (n) {
  if (n == null || n === '') return '—'
  const x = Number(n)
  if (Number.isNaN(x)) return '—'
  return x.toFixed(2)
}

function escapeHtml (s) {
  if (s == null) return ''
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

function translateError (msg) {
  if (!msg) return msg
  const t = App.t
  if (!t) return msg
  if (msg.includes('SEC rate limit exceeded')) return t('error.secRateLimit')
  if (msg.includes('Invalid CIK')) return t('error.invalidCik')
  if (msg.includes('No available document found')) return t('error.noDocument')
  return msg
}

function showLoading (show) {
  const el = App.dom.loadingEl
  if (el) el.classList.toggle('hidden', !show)
}

function showError (message) {
  const el = App.dom.errorEl
  if (!el) return
  if (!message) {
    el.classList.add('hidden')
    return
  }
  el.textContent = message
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 5000)
}

  App.utils = {
    formatNum,
    formatDate,
    formatPrice,
    formatRatio,
    escapeHtml,
    translateError,
    showLoading,
    showError
  }
})()

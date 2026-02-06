/**
 * i18n module for renderer process.
 * Depends on window.i18n.get() from preload.
 */
;(function () {
let translations = { en: {}, zh: {} }
let locale = 'en'

const LOCALE_KEY = 'i18n.locale'

function getStoredLocale () {
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch (_) {}
  return 'en'
}

function saveLocale (l) {
  try {
    window.localStorage.setItem(LOCALE_KEY, l)
  } catch (_) {}
}

/**
 * Translate a key. Falls back to en, then to key itself.
 */
function t (key, params) {
  let str = (translations[locale] && translations[locale][key]) ||
    (translations.en && translations.en[key]) ||
    key
  if (params && typeof str === 'string') {
    Object.keys(params).forEach((k) => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]))
    })
  }
  return str
}

/**
 * Set locale and optionally save to localStorage.
 */
function setLocale (l, save = true) {
  if (l !== 'en' && l !== 'zh') return
  locale = l
  if (save) saveLocale(l)
}

function getLocale () {
  return locale
}

/**
 * Apply translations to elements with data-i18n.
 * For inputs: data-i18n-placeholder for placeholder.
 * Skip option elements - they need special handling (value vs text).
 */
function applyToPage () {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.tagName === 'OPTION') return
    const key = el.getAttribute('data-i18n')
    if (key) el.textContent = t(key)
  })
  document.querySelectorAll('option[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    if (key) el.textContent = t(key)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder')
    if (key) el.placeholder = t(key)
  })
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label')
    if (key) el.setAttribute('aria-label', t(key))
  })
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
}

/**
 * Initialize i18n: fetch translations and set locale.
 * Returns { t, setLocale, getLocale, applyToPage } when ready.
 */
async function init () {
  const data = await window.i18n.get()
  if (data && data.en) translations.en = data.en
  if (data && data.zh) translations.zh = data.zh
  locale = getStoredLocale()
  return { t, setLocale, getLocale, applyToPage }
}

// Export for use in renderer
window.__i18nInit = init
})()

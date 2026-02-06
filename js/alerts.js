/**
 * Price alerts UI and wiring.
 */
;(function () {
  const App = window.App
  if (!App) return

  async function loadAllAlerts () {
    if (!window.alertsApi) return []
    try {
      const res = await window.alertsApi.getAll()
      if (!res || !res.ok) {
        if (res && res.error) console.error('alerts:getAll failed:', res.error)
        return []
      }
      const data = res.data
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.alerts)) return data.alerts
      return []
    } catch (err) {
      console.error('alerts:getAll error:', err)
      return []
    }
  }

  function renderAllAlerts (allAlerts) {
    const container = App.dom.allAlertsList
    if (!container) return

    container.innerHTML = ''

    if (!allAlerts || allAlerts.length === 0) {
      container.innerHTML =
        '<p class="alerts-empty">' +
        (App.t('alerts.globalEmpty') || 'You have not created any alerts yet.') +
        '</p>'
      return
    }

    const normalized = allAlerts
      .filter((a) => a && a.id)
      .slice()
      .sort((a, b) => {
        const symA = String(a.symbol || '').toUpperCase()
        const symB = String(b.symbol || '').toUpperCase()
        if (symA === symB) {
          return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
        }
        return symA.localeCompare(symB)
      })

    container.innerHTML = normalized
      .map((a) => {
        const sym = String(a.symbol || '').toUpperCase()
        const condKey = a.condition === 'below' ? 'below' : 'above'
        const condLabelAbove = App.t('alerts.condition.above') || 'Above'
        const condLabelBelow = App.t('alerts.condition.below') || 'Below'
        const target = Number(a.targetPrice)
        const priceValue = Number.isFinite(target)
          ? target.toString()
          : String(a.targetPrice || '')

        return `
          <div class="alerts-list-item" data-alert-id="${App.utils.escapeHtml(a.id)}">
            <div class="alerts-list-main">
              <span class="alert-symbol">${App.utils.escapeHtml(sym)}</span>
              <select class="alert-edit-condition alerts-select">
                <option value="above"${condKey === 'above' ? ' selected' : ''}>${App.utils.escapeHtml(condLabelAbove)}</option>
                <option value="below"${condKey === 'below' ? ' selected' : ''}>${App.utils.escapeHtml(condLabelBelow)}</option>
              </select>
              <input
                type="number"
                step="0.01"
                class="alerts-input alert-edit-price"
                value="${App.utils.escapeHtml(priceValue)}"
              />
            </div>
            <div class="alerts-list-actions">
              <button type="button" class="alert-save-btn">
                ${App.t('alerts.save') || 'Save'}
              </button>
              <button type="button" class="alert-delete-btn">
                ${App.t('alerts.delete') || 'Delete'}
              </button>
            </div>
          </div>
        `
      })
      .join('')

    container.querySelectorAll('.alert-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const parent = btn.closest('.alerts-list-item')
        const id = parent && parent.getAttribute('data-alert-id')
        if (!id || !window.alertsApi) return
        try {
          const res = await window.alertsApi.remove(id)
          if (!res || !res.ok) {
            console.error('alerts:remove failed:', res && res.error)
          }
        } catch (err) {
          console.error('alerts:remove error:', err)
        }
        if (App.alerts && typeof App.alerts.refreshForCurrentSymbol === 'function') {
          App.alerts.refreshForCurrentSymbol()
        }
      })
    })

    container.querySelectorAll('.alert-save-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const parent = btn.closest('.alerts-list-item')
        if (!parent || !window.alertsApi) return
        const id = parent.getAttribute('data-alert-id')
        const condEl = parent.querySelector('.alert-edit-condition')
        const priceEl = parent.querySelector('.alert-edit-price')
        if (!id || !condEl || !priceEl) return

        const condition = condEl.value === 'below' ? 'below' : 'above'
        const targetPrice = Number(priceEl.value)
        if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
          if (App.utils && typeof App.utils.showError === 'function') {
            App.utils.showError(
              App.t('alerts.invalidPrice') || 'Enter a valid target price greater than 0.'
            )
          }
          return
        }

        try {
          const res = await window.alertsApi.update({ id, condition, targetPrice })
          if (!res || !res.ok) {
            const msg =
              (App.utils &&
                typeof App.utils.translateError === 'function' &&
                App.utils.translateError(res && res.error)) ||
              (res && res.error) ||
              (App.t('alerts.updateFailed') || 'Failed to update alert.')
            if (App.utils && typeof App.utils.showError === 'function') {
              App.utils.showError(msg)
            } else {
              console.error(msg)
            }
            return
          }
          if (App.alerts && typeof App.alerts.refreshForCurrentSymbol === 'function') {
            App.alerts.refreshForCurrentSymbol()
          }
        } catch (err) {
          console.error('alerts:update error:', err)
          if (App.utils && typeof App.utils.showError === 'function') {
            App.utils.showError(App.t('alerts.updateFailed') || 'Failed to update alert.')
          }
        }
      })
    })
  }

  function renderAlertsForSymbol (allAlerts, symbol) {
    const container = App.dom.alertsList
    if (!container) return

    container.innerHTML = ''

    if (!symbol) {
      container.innerHTML =
        '<p class="alerts-empty">' +
        (App.t('alerts.noSymbol') || 'Select a symbol to create price alerts.') +
        '</p>'
      return
    }

    const sym = symbol.toUpperCase()
    const filtered = allAlerts.filter((a) => a && String(a.symbol || '').toUpperCase() === sym)

    if (filtered.length === 0) {
      container.innerHTML =
        '<p class="alerts-empty">' +
        (App.t('alerts.noneForSymbol') || 'No alerts for this symbol yet.') +
        '</p>'
      return
    }

    container.innerHTML = filtered
      .map((a) => {
        const condKey = a.condition === 'below' ? 'below' : 'above'
        const condLabel = App.t('alerts.condition.' + condKey) || (condKey === 'below' ? 'Below' : 'Above')
        const target = Number(a.targetPrice)
        const priceText = Number.isFinite(target)
          ? target.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })
          : String(a.targetPrice || '')

        return `
          <div class="alerts-list-item" data-alert-id="${App.utils.escapeHtml(a.id)}">
            <div class="alerts-list-main">
              <span class="alert-symbol">${App.utils.escapeHtml(sym)}</span>
              <span class="alert-condition">${App.utils.escapeHtml(condLabel)}</span>
              <span class="alert-target">${priceText}</span>
            </div>
            <button type="button" class="alert-delete-btn">
              ${App.t('alerts.delete') || 'Delete'}
            </button>
          </div>
        `
      })
      .join('')

    container.querySelectorAll('.alert-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const parent = btn.closest('.alerts-list-item')
        const id = parent && parent.getAttribute('data-alert-id')
        if (!id || !window.alertsApi) return
        try {
          const res = await window.alertsApi.remove(id)
          if (!res || !res.ok) {
            console.error('alerts:remove failed:', res && res.error)
          }
        } catch (err) {
          console.error('alerts:remove error:', err)
        }
        if (App.alerts && typeof App.alerts.refreshForCurrentSymbol === 'function') {
          App.alerts.refreshForCurrentSymbol()
        }
      })
    })
  }

  App.alerts = App.alerts || {}

  App.alerts.refreshForCurrentSymbol = async function refreshForCurrentSymbol () {
    const symbol = App.state.currentSymbol
    const all = await loadAllAlerts()
    renderAlertsForSymbol(all, symbol)
    renderAllAlerts(all)
  }

  App.alerts.init = function initAlerts () {
    const btn = App.dom.alertCreateBtn
    const condEl = App.dom.alertCondition
    const priceEl = App.dom.alertPrice

    if (!btn || !condEl || !priceEl || !window.alertsApi) {
      return
    }

    btn.addEventListener('click', async () => {
      const symbol = App.state.currentSymbol
      if (!symbol) {
        if (App.utils && typeof App.utils.showError === 'function') {
          App.utils.showError(
            App.t('alerts.noSymbolError') || 'Select a symbol before creating an alert.'
          )
        }
        return
      }

      const condition = condEl.value === 'below' ? 'below' : 'above'
      const targetPrice = Number(priceEl.value)

      if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        if (App.utils && typeof App.utils.showError === 'function') {
          App.utils.showError(
            App.t('alerts.invalidPrice') || 'Enter a valid target price greater than 0.'
          )
        }
        return
      }

      try {
        const res = await window.alertsApi.add({ symbol, condition, targetPrice })
        if (!res || !res.ok) {
          const msg =
            (App.utils &&
              typeof App.utils.translateError === 'function' &&
              App.utils.translateError(res && res.error)) ||
            (res && res.error) ||
            'Failed to create alert.'
          if (App.utils && typeof App.utils.showError === 'function') {
            App.utils.showError(msg)
          } else {
            console.error(msg)
          }
          return
        }
        priceEl.value = ''
        App.alerts.refreshForCurrentSymbol()
      } catch (err) {
        console.error('alerts:add error:', err)
        if (App.utils && typeof App.utils.showError === 'function') {
          App.utils.showError(App.t('alerts.createFailed') || 'Failed to create alert.')
        }
      }
    })

    App.alerts.refreshForCurrentSymbol()
  }
})()


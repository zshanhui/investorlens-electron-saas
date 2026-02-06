/**
 * SEC EDGAR filings: search, company selection, filings list, PDF download.
 */
;(function () {
  const App = window.App

  function getEdgarFormFilter () {
  if (!App.dom.edgarFormFilter) return []
  const val = App.dom.edgarFormFilter.value || ''
  if (!val.trim()) return []
  return val.split(',').map((x) => x.trim()).filter(Boolean)
}

async function openEdgarForSymbol (symbol) {
  const query = String(symbol || '').trim()
  if (!query || !window.edgar) return

  if (App.dom.edgarHint) App.dom.edgarHint.classList.add('hidden')
  if (App.dom.edgarCompanyList) App.dom.edgarCompanyList.classList.add('hidden')
  if (App.dom.edgarCompanyList) App.dom.edgarCompanyList.innerHTML = ''
  if (App.dom.edgarSelectedCompany) App.dom.edgarSelectedCompany.classList.add('hidden')
  if (App.dom.edgarFilingsWrap) App.dom.edgarFilingsWrap.classList.add('hidden')
  if (App.dom.edgarFilingsBody) App.dom.edgarFilingsBody.innerHTML = ''
  if (App.dom.edgarFilingsHint) {
    App.dom.edgarFilingsHint.classList.remove('hidden')
    App.dom.edgarFilingsHint.textContent = App.t('edgar.searching')
  }
  App.utils.showLoading(true)
  App.utils.showError(null)

  const result = await window.edgar.searchCompany(query)
  App.utils.showLoading(false)

  if (!result.ok) {
    App.utils.showError(App.utils.translateError(result.error) || App.t('error.edgarSearchFailed'))
    if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.textContent = App.utils.translateError(result.error) || App.t('error.searchFailedShort')
    return
  }

  const companies = result.data || []
  if (companies.length === 0) {
    if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.textContent = App.t('edgar.noRegistrant')
    return
  }

  const upper = query.toUpperCase()
  const exact = companies.find((c) => String(c.ticker || '').toUpperCase() === upper) || companies[0]
  selectEdgarCompany(exact)
}

async function doEdgarSearch () {
  const query = App.dom.edgarSearchInput ? App.dom.edgarSearchInput.value.trim() : ''
  if (!query || !window.edgar) return

  if (App.dom.edgarHint) App.dom.edgarHint.classList.add('hidden')
  if (App.dom.edgarCompanyList) App.dom.edgarCompanyList.classList.add('hidden')
  if (App.dom.edgarCompanyList) App.dom.edgarCompanyList.innerHTML = ''
  if (App.dom.edgarSelectedCompany) App.dom.edgarSelectedCompany.classList.add('hidden')
  if (App.dom.edgarFilingsWrap) App.dom.edgarFilingsWrap.classList.add('hidden')
  if (App.dom.edgarFilingsBody) App.dom.edgarFilingsBody.innerHTML = ''
  if (App.dom.edgarFilingsHint) {
    App.dom.edgarFilingsHint.classList.remove('hidden')
    App.dom.edgarFilingsHint.textContent = App.t('edgar.searching')
  }
  App.utils.showLoading(true)
  App.utils.showError(null)

  const result = await window.edgar.searchCompany(query)
  App.utils.showLoading(false)

  if (!result.ok) {
    App.utils.showError(App.utils.translateError(result.error) || App.t('error.edgarSearchFailed'))
    if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.textContent = App.utils.translateError(result.error) || App.t('error.searchFailedShort')
    return
  }

  const companies = result.data || []
  if (companies.length === 0) {
    if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.textContent = App.t('edgar.noCompanies')
    return
  }

  if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.classList.add('hidden')
  if (companies.length === 1) {
    selectEdgarCompany(companies[0])
    return
  }

  if (App.dom.edgarCompanyList) App.dom.edgarCompanyList.classList.remove('hidden')
  companies.slice(0, 15).forEach((company) => {
    const div = document.createElement('div')
    div.className = 'edgar-company-item'
    div.innerHTML = `<span class="symbol">${App.utils.escapeHtml(company.ticker || '')}</span> ${App.utils.escapeHtml(company.name || '')}`
    div.addEventListener('click', () => selectEdgarCompany(company))
    if (App.dom.edgarCompanyList) App.dom.edgarCompanyList.appendChild(div)
  })
}

async function selectEdgarCompany (company) {
  App.state.currentEdgarCompany = company
  if (App.dom.edgarCompanyList) {
    App.dom.edgarCompanyList.classList.add('hidden')
    App.dom.edgarCompanyList.innerHTML = ''
  }
  if (App.dom.edgarSelectedCompany) {
    App.dom.edgarSelectedCompany.classList.remove('hidden')
    App.dom.edgarSelectedCompany.textContent = App.t('edgar.companyLabel', {
      ticker: company.ticker || '',
      name: company.name || '',
      cik: company.cik || ''
    })
  }
  if (App.dom.edgarFilingsWrap) App.dom.edgarFilingsWrap.classList.add('hidden')
  if (App.dom.edgarFilingsBody) App.dom.edgarFilingsBody.innerHTML = ''
  if (App.dom.edgarFilingsHint) {
    App.dom.edgarFilingsHint.classList.remove('hidden')
    App.dom.edgarFilingsHint.textContent = App.t('edgar.loadingFilings')
  }
  App.utils.showLoading(true)
  App.utils.showError(null)

  const forms = getEdgarFormFilter()
  const result = await window.edgar.getFilings({ cik: company.cik, forms })
  App.utils.showLoading(false)

  if (!result.ok) {
    App.utils.showError(App.utils.translateError(result.error) || App.t('error.loadFilingsFailed'))
    if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.textContent = App.utils.translateError(result.error) || App.t('error.loadFilingsFailed')
    return
  }

  App.state.edgarFilings = result.data || []
  if (App.dom.edgarFilingsHint) App.dom.edgarFilingsHint.classList.add('hidden')
  if (App.state.edgarFilings.length === 0) {
    if (App.dom.edgarFilingsHint) {
      App.dom.edgarFilingsHint.classList.remove('hidden')
      App.dom.edgarFilingsHint.textContent = App.t('edgar.noFilings')
    }
    return
  }

  if (App.dom.edgarFilingsWrap) App.dom.edgarFilingsWrap.classList.remove('hidden')
  App.dom.edgarFilingsBody.innerHTML = App.state.edgarFilings
    .map(
      (f) => `
        <tr>
          <td>${App.utils.formatDate(f.filingDate)}</td>
          <td>${App.utils.escapeHtml(f.form || '')}</td>
          <td>${App.utils.formatDate(f.reportDate)}</td>
          <td>${App.utils.escapeHtml(f.description || '')}</td>
          <td>
            <div class="edgar-action-btns">
              <button type="button" class="edgar-btn download-pdf" data-accession="${App.utils.escapeHtml(f.accessionNumber)}" data-cik="${App.utils.escapeHtml(f.cik)}" data-primary="${App.utils.escapeHtml(f.primaryDocument || '')}">${App.t('edgar.download')}</button>
              <button type="button" class="edgar-btn open" data-accession="${App.utils.escapeHtml(f.accessionNumber)}" data-cik="${App.utils.escapeHtml(f.cik)}" data-primary="${App.utils.escapeHtml(f.primaryDocument || '')}">${App.t('edgar.viewReport')}</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('')

  App.dom.edgarFilingsBody.querySelectorAll('.download-pdf').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cik = btn.getAttribute('data-cik')
      const accessionNumber = btn.getAttribute('data-accession')
      const primaryDocument = btn.getAttribute('data-primary') || undefined
      if (!cik || !accessionNumber) return
      btn.disabled = true
      btn.textContent = App.t('edgar.downloading')
      App.utils.showError(null)
      try {
        const res = await window.edgar.downloadPdf({ cik, accessionNumber, primaryDocument })
        if (res.ok) {
          const openBtn = btn.nextElementSibling
          if (openBtn) openBtn.dataset.path = res.path
          btn.remove()
        } else {
          App.utils.showError(App.utils.translateError(res.error) || App.t('error.downloadFailed'))
          btn.textContent = App.t('edgar.download')
          btn.disabled = false
        }
      } catch (err) {
        App.utils.showError(App.utils.translateError(err.message) || App.t('error.downloadFailed'))
        btn.textContent = App.t('edgar.download')
        btn.disabled = false
      }
    })
  })

  App.dom.edgarFilingsBody.querySelectorAll('.edgar-btn.open').forEach((btn) => {
    btn.addEventListener('click', async () => {
      let path = btn.dataset.path
      const cik = btn.getAttribute('data-cik')
      const accessionNumber = btn.getAttribute('data-accession')
      const primaryDocument = btn.getAttribute('data-primary') || undefined
      if (!path && cik && accessionNumber) {
        btn.disabled = true
        btn.textContent = App.t('edgar.preparing')
        try {
          const res = await window.edgar.downloadPdf({ cik, accessionNumber, primaryDocument })
          if (res.ok) {
            path = res.path
            btn.dataset.path = res.path
          }
        } catch (_) {}
        btn.disabled = false
        btn.textContent = App.t('edgar.viewReport')
      }
      if (path && window.edgar.openPdf) window.edgar.openPdf(path)
    })
  })
}

App.edgar = {
  openEdgarForSymbol,
  doEdgarSearch,
  selectEdgarCompany,
  getEdgarFormFilter
}

if (App.dom.edgarSearchBtn) {
  App.dom.edgarSearchBtn.addEventListener('click', doEdgarSearch)
}
if (App.dom.edgarSearchInput) {
  App.dom.edgarSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doEdgarSearch()
  })
}
  if (App.dom.edgarFormFilter) {
    App.dom.edgarFormFilter.addEventListener('change', () => {
      if (App.state.currentEdgarCompany) selectEdgarCompany(App.state.currentEdgarCompany)
    })
  }
})()

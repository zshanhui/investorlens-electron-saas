/**
 * DOM refs and shared app state.
 * Must load first.
 */
;(function () {
  const App = window.App = window.App || {}

  App.dom = {
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  resultsList: document.getElementById('resultsList'),
  resultsHint: document.getElementById('resultsHint'),
  themeToggle: document.getElementById('themeToggle'),
  langSwitch: document.getElementById('langSwitch'),
  quickTiles: document.querySelectorAll('.quick-tile'),
  etfTiles: document.querySelectorAll('.etf-tile'),
  quotePanel: document.getElementById('quotePanel'),
  detailHint: document.getElementById('detailHint'),
  loadingEl: document.getElementById('loading'),
  errorEl: document.getElementById('error'),
  quoteSymbol: document.getElementById('quoteSymbol'),
  quoteName: document.getElementById('quoteName'),
  quotePrice: document.getElementById('quotePrice'),
  quoteChange: document.getElementById('quoteChange'),
  quoteValuation: document.getElementById('quoteValuation'),
  quoteMovement: document.getElementById('quoteMovement'),
  historyBody: document.getElementById('historyBody'),
  historyChart: document.getElementById('historyChart'),
  tabQuote: document.getElementById('tabQuote'),
  tabFinancials: document.getElementById('tabFinancials'),
  tabEdgar: document.getElementById('tabEdgar'),
  tabEtf: document.getElementById('tabEtf'),
  financialsPanel: document.getElementById('financialsPanel'),
  edgarPanel: document.getElementById('edgarPanel'),
  edgarHint: document.getElementById('edgarHint'),
  edgarSearchInput: document.getElementById('edgarSearchInput'),
  edgarSearchBtn: document.getElementById('edgarSearchBtn'),
  edgarSearchBar: document.querySelector('.edgar-search-bar'),
  edgarCompanyList: document.getElementById('edgarCompanyList'),
  edgarSelectedCompany: document.getElementById('edgarSelectedCompany'),
  edgarFormFilter: document.getElementById('edgarFormFilter'),
  edgarFilingsWrap: document.getElementById('edgarFilingsWrap'),
  edgarFilingsBody: document.getElementById('edgarFilingsBody'),
  edgarFilingsHint: document.getElementById('edgarFilingsHint'),
  financialsStatus: document.getElementById('financialsStatus'),
  incomeHead: document.getElementById('incomeHead'),
  incomeBody: document.getElementById('incomeBody'),
  balanceHead: document.getElementById('balanceHead'),
  balanceBody: document.getElementById('balanceBody'),
  incomeTableWrap: document.getElementById('incomeTableWrap'),
  balanceTableWrap: document.getElementById('balanceTableWrap'),
  subtabIncome: document.getElementById('subtabIncome'),
  subtabBalance: document.getElementById('subtabBalance'),
  etfPanel: document.getElementById('etfPanel'),
  etfStatus: document.getElementById('etfStatus'),
  etfExpenseSection: document.getElementById('etfExpenseSection'),
  etfExpenseValue: document.getElementById('etfExpenseValue'),
  etfHoldingsSection: document.getElementById('etfHoldingsSection'),
  etfHoldingsList: document.getElementById('etfHoldingsList'),
  etfComingSoon: document.getElementById('etfComingSoon')
}

App.state = {
  currentSymbol: null,
  currentIsEtf: false,
  financialsLoadedFor: null,
  etfDetailsLoadedFor: null,
  historyChartInstance: null,
  currentEdgarCompany: null,
  edgarFilings: []
}

  App.t = (k) => k
})()

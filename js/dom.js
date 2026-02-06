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
  nasdaqQuickGrid: document.getElementById('nasdaqQuickGrid'),
  etfQuickGrid: document.getElementById('etfQuickGrid'),
  quotePanel: document.getElementById('quotePanel'),
  detailHint: document.getElementById('detailHint'),
  loadingEl: document.getElementById('loading'),
  errorEl: document.getElementById('error'),
  quoteSymbol: document.getElementById('quoteSymbol'),
  quoteName: document.getElementById('quoteName'),
  quotePrice: document.getElementById('quotePrice'),
  quoteChange: document.getElementById('quoteChange'),
  quoteUpdated: document.getElementById('quoteUpdated'),
  quoteValuation: document.getElementById('quoteValuation'),
  quoteMovement: document.getElementById('quoteMovement'),
  historyBody: document.getElementById('historyBody'),
  historyChart: document.getElementById('historyChart'),
  tabQuote: document.getElementById('tabQuote'),
  tabFinancials: document.getElementById('tabFinancials'),
  tabEdgar: document.getElementById('tabEdgar'),
  tabEtf: document.getElementById('tabEtf'),
  detailTabs: document.querySelector('.detail-tabs'),
  alertsScreen: document.getElementById('alertsScreen'),
  alertsBackBtn: document.getElementById('alertsBackBtn'),
  openAlertsScreenBtn: document.getElementById('openAlertsScreenBtn'),
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
  edgarLastFetched: document.getElementById('edgarLastFetched'),
  edgarRefreshBtn: document.getElementById('edgarRefreshBtn'),
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
  etfComingSoon: document.getElementById('etfComingSoon'),
  alertCondition: document.getElementById('alertCondition'),
  alertPrice: document.getElementById('alertPrice'),
  alertCreateBtn: document.getElementById('alertCreateBtn'),
  alertsList: document.getElementById('alertsList'),
  allAlertsList: document.getElementById('allAlertsList')
}

App.state = {
  currentSymbol: null,
  currentIsEtf: false,
  financialsLoadedFor: null,
  etfDetailsLoadedFor: null,
  historyChartInstance: null,
  currentEdgarCompany: null,
  edgarFilings: [],
  edgarLastFetchedAt: null,
  currentDetailPanel: 'quote'
}

  App.t = (k) => k
})()

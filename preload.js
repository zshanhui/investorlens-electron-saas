const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('stockApi', {
  search: (query) => ipcRenderer.invoke('stock:search', query),
  getQuote: (symbol) => ipcRenderer.invoke('stock:quote', symbol),
  getHistorical: (symbol, period1, period2) =>
    ipcRenderer.invoke('stock:historical', symbol, period1, period2),
  getFinancials: (symbol) => ipcRenderer.invoke('stock:financials', symbol),
  getEtfDetails: (symbol) => ipcRenderer.invoke('stock:etfDetails', symbol)
})

contextBridge.exposeInMainWorld('alertsApi', {
  getAll: () => ipcRenderer.invoke('alerts:getAll'),
  add: (payload) => ipcRenderer.invoke('alerts:add', payload),
  remove: (id) => ipcRenderer.invoke('alerts:remove', id),
  update: (payload) => ipcRenderer.invoke('alerts:update', payload)
})

contextBridge.exposeInMainWorld('i18n', {
  get: () => ipcRenderer.invoke('i18n:get')
})

contextBridge.exposeInMainWorld('edgar', {
  searchCompany: (query) => ipcRenderer.invoke('edgar:searchCompany', query),
  getFilings: (opts) => ipcRenderer.invoke('edgar:getFilings', opts),
  downloadPdf: (opts) => ipcRenderer.invoke('edgar:downloadPdf', opts),
  openPdf: (pdfPath) => ipcRenderer.invoke('edgar:openPdf', pdfPath)
})

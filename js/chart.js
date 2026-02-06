/**
 * Price history chart (ECharts).
 */
;(function () {
  const App = window.App

  function renderHistoryChart (rows) {
    const historyChart = App.dom.historyChart
  if (!historyChart) return

  if (!Array.isArray(rows) || rows.length === 0) {
    historyChart.innerHTML = '<div class="history-chart-empty">' + App.t('chart.noData') + '</div>'
    return
  }

  const points = rows
    .filter(r => r && r.close != null && r.date)
    .slice(-252)

  if (points.length === 0) {
    historyChart.innerHTML = '<div class="history-chart-empty">' + App.t('chart.noData') + '</div>'
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

  if (App.state.historyChartInstance) {
    App.state.historyChartInstance.dispose()
    App.state.historyChartInstance = null
  }

  if (typeof echarts === 'undefined') {
    historyChart.innerHTML = '<div class="history-chart-empty">' + App.t('chart.loadFailed') + '</div>'
    return
  }

  App.state.historyChartInstance = echarts.init(historyChart)

  const option = {
    animation: true,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: { backgroundColor: '#1f2937' }
      },
      valueFormatter: (value) => (value == null ? '—' : App.utils.formatPrice(value))
    },
    grid: { left: 40, right: 16, top: 10, bottom: 26 },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#445469' } },
      axisLabel: { color: '#8b9eb0' },
      splitLine: { show: false }
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
          return x.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          })
        }
      },
      splitLine: { lineStyle: { color: 'rgba(136, 153, 168, 0.2)' } }
    },
    dataZoom: [{ type: 'inside', throttle: 50 }],
    series: [
      {
        type: 'line',
        name: App.t('quote.close'),
        showSymbol: false,
        smooth: true,
        lineStyle: { color: strokeColor, width: 2 },
        areaStyle: {
          color: positive ? 'rgba(63, 185, 80, 0.25)' : 'rgba(248, 81, 73, 0.25)'
        },
        data
      }
    ]
  }

    App.state.historyChartInstance.setOption(option)
  }

  App.renderHistoryChart = renderHistoryChart
})()

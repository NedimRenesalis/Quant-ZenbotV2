#!/usr/bin/env node
let ccxt = require('ccxt')

new ccxt.binance().fetch_markets().then(function(markets) {
  var products = []

  var products = markets.map(function (market) {
    const filters = market.info.filters
    const price_filter = filters.find(f => f.filterType === 'PRICE_FILTER')
    const lot_size_filter = filters.find(f => f.filterType === 'LOT_SIZE')
    const notional_filter = filters.find(f => f.filterType === 'MIN_NOTIONAL')

    // Default values in case filters are missing
    let minQty = '0.00000001'
    let maxQty = '10000000'
    let minNotional = '10.00000000'
    let tickSize = '0.00000001'
    let stepSize = '0.00000001'

    // Use filter values if they exist
    if (lot_size_filter) {
      minQty = lot_size_filter.minQty || minQty
      maxQty = lot_size_filter.maxQty || maxQty
      stepSize = lot_size_filter.stepSize || stepSize
    }

    if (price_filter) {
      tickSize = price_filter.tickSize || tickSize
    }

    if (notional_filter) {
      minNotional = notional_filter.minNotional || minNotional
    }

    // NOTE: price_filter also contains minPrice and maxPrice
    return {
      id: market.id,
      asset: market.base,
      currency: market.quote,
      min_size: minQty,
      max_size: maxQty,
      min_total: minNotional,
      increment: tickSize,
      asset_increment: stepSize,
      label: market.base + '/' + market.quote
    }
  })

  var target = require('path').resolve(__dirname, 'products.json')
  require('fs').writeFileSync(target, JSON.stringify(products, null, 2))
  console.log('wrote', target)
  process.exit()
})

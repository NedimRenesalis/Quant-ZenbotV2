var c = module.exports = {}

// Absolute minimum settings
c.strategy = 'stddev'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 10
c.enable_adaptive_sizing = false
c.currency_capital = 1000
c.asset_capital = 0
c.keep_lookback_periods = 20
c.poll_trades = 100
c.order_adjust_time = 100
c.order_poll_time = 100
c.wait_for_settlement = 100
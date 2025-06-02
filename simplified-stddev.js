var c = module.exports = {}

// Basic settings
c.strategy = 'speed'  // Try a different strategy
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 20

// Memory optimization settings
c.keep_lookback_periods = 30
c.currency_capital = 1000
c.asset_capital = 0

// Performance optimizations
c.poll_trades = 1000
c.order_adjust_time = 1000
c.order_poll_time = 1000
c.wait_for_settlement = 1000
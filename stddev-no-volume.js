var c = module.exports = {}

// Basic settings
c.strategy = 'stddev'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 20

// Explicitly disable volume-based features
c.enable_adaptive_sizing = false

// Other recommended settings
c.keep_lookback_periods = 100
c.currency_capital = 1000
c.asset_capital = 0
c.poll_trades = 500
c.order_adjust_time = 500
c.order_poll_time = 500
c.wait_for_settlement = 300

// Performance optimizations
c.fast_execution = true
c.calculation_skip_ticks = 1

// Ensure you have enough data
c.days = 30  // Request more days of data

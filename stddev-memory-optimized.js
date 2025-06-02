var c = module.exports = {}

// Basic settings
c.strategy = 'stddev'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 20

// Memory optimization settings
c.keep_lookback_periods = 30  // Reduce this to save memory
c.enable_adaptive_sizing = false
c.currency_capital = 1000
c.asset_capital = 0

// Performance optimizations
c.fast_execution = true
c.calculation_skip_ticks = 2  // Skip more ticks to reduce calculations
c.performance_report = false  // Disable performance reporting to save memory

// Reduce polling frequency to minimize memory usage
c.poll_trades = 1000
c.order_adjust_time = 1000
c.order_poll_time = 1000
c.wait_for_settlement = 1000

// Disable unnecessary features
c.debug_log = false
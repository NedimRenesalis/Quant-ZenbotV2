var c = module.exports = {}

// Absolute minimal settings
c.strategy = 'stddev'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 10  // Reduced from 20

// Memory optimization
c.keep_lookback_periods = 15  // Reduced significantly
c.currency_capital = 1000
c.asset_capital = 0

// Extreme performance optimizations
c.fast_execution = true
c.calculation_skip_ticks = 3  // Skip more ticks to reduce calculations
c.performance_report = false  // Disable performance reporting to save memory

// Reduce polling frequency to minimize memory usage
c.poll_trades = 5000
c.order_adjust_time = 5000
c.order_poll_time = 5000
c.wait_for_settlement = 5000

// Disable all advanced features
c.enable_adaptive_sizing = false
c.enable_volume_integration = false
c.enable_weighted_scoring = false
c.debug_log = false

// Disable unnecessary features
c.profit_stop_enable_pct = 0
c.sell_stop_pct = 0
c.buy_stop_pct = 0

// MongoDB configuration
c.mongo = {}
c.mongo.db = 'zenbot4'
c.mongo.host = 'localhost'
c.mongo.port = 27017
